// /lib/zalo_runner.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Zalo, ThreadType } from 'zca-js';
import proxyAgent from 'https-proxy-agent';
const { HttpsProxyAgent } = proxyAgent;

import { ZaloAccountModel } from '../models/zalo-session.model.js';
import { ZaloThreadModel } from '../models/zalo-thread.model.js';
import { ZaloMessageModel } from '../models/zalo-message.model.js';
import { uploadBufferToDrive } from './drive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// mime guess (đủ dùng cho ảnh cơ bản)
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic']);
function guessMimeFromName(name = '') {
    const ext = (name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]) || '';
    if (IMAGE_EXT.has(ext)) return `image/${ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '')}`;
    return 'application/octet-stream';
}

/** Chuẩn hoá message từ zca-js -> DB */
function normalizeIncomingMessage(m) {
    const d = m?.data || {};
    const isSelf = !!m.isSelf;
    const attFromApi = Array.isArray(d?.attachments) ? d.attachments : [];

    const imgs = Array.isArray(d?.content?.images) ? d.content.images : [];
    const attImages = imgs.map((u, i) => ({
        name: `image_${i + 1}.jpg`, mime: 'image/jpeg', size: 0, url: u, path: '', type: 'image'
    }));

    let contentType = 'text';
    if (attFromApi.length > 0 || attImages.length > 0) contentType = 'file';
    if (d?.content?.type === 'sticker') contentType = 'sticker';
    if (attImages.length > 0) contentType = 'image';

    const attachments = [...attFromApi.map(a => ({
        name: a?.name || a?.filename || '',
        mime: a?.mime || '',
        size: Number(a?.size || 0),
        url: a?.url || '',
        path: a?.path || '',
        type: a?.type || 'file'
    })), ...attImages];

    return {
        threadId: String(m.threadId),
        msgId: d.msgId ? String(d.msgId) : null,
        cliMsgId: d.cliMsgId ? String(d.cliMsgId) : null,
        isSelf,
        direction: isSelf ? 'out' : 'in',
        contentType,
        text: typeof d?.content === 'string' ? d.content : (d?.content?.text || ''),
        attachments,
        ts: new Date(Number(d?.ts || Date.now())),
        raw: m
    };
}

export class ZaloRunner {
    constructor(id, io, manager) {
        this.id = id;
        this.io = io;
        this.manager = manager;
        this.api = null;
        this._zalo = null;

        this.status = 'offline';
        this.proxy = null;

        this.profile = null;
        this.displayName = null;
        this.avatar = null;
        this.uid = null;
        this.phone = null;
        this.lastLoginAt = null;

        this._msgBuf = new Map();
        this._bufMax = 200;
    }

    _emit(event, data = {}) { try { this.io?.emit(event, { id: this.id, ...data }); } catch (e) { console.log('[runner] emit error', { id: this.id, event, err: e?.message }); } }

    async _waitAndEmitQR(qrPath, timeoutMs = 60_000) {
        console.log('[runner] wait QR file ...', { id: this.id, qrPath });
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const buf = await fs.promises.readFile(qrPath);
                const base64 = buf.toString('base64');
                const dataURL = `data:image/png;base64,${base64}`;
                this._emit('zalo:qr', { image: dataURL });

                // xoá QR sau khi phát để tránh phình dữ liệu
                try { await fs.promises.unlink(qrPath); } catch { }
                return;
            } catch { await new Promise((r) => setTimeout(r, 250)); }
        }
        console.log('[runner] QR not found in time', { id: this.id });
    }

    _buildZaloOptions(proxy) {
        const opts = { selfListen: false, checkUpdate: true, logging: true };
        if (proxy) { try { opts.agent = new HttpsProxyAgent(proxy); } catch (e) { console.log('[runner] proxy agent error', { id: this.id, err: e?.message }); } }
        return opts;
    }

    async _saveCtx(api) {
        const ctx = api.getContext();
        let cookieData = null;
        try {
            const jar = api.getCookie?.() ?? ctx.cookie;
            cookieData = typeof jar?.toJSON === 'function' ? jar.toJSON() : jar;
        } catch { cookieData = ctx.cookie; }

        await ZaloAccountModel.updateOne(
            { id: this.id },
            { $set: { id: this.id, cookie: cookieData, imei: ctx.imei, userAgent: ctx.userAgent, lastLoginAt: new Date(), updatedAt: new Date() } },
            { upsert: true }
        );
        this.lastLoginAt = new Date();
    }

    async _saveProfile(api) {
        try {
            const info = await api.fetchAccountInfo?.();
            const p = info?.profile ?? info ?? {};
            this.profile = {
                userId: p.userId ? String(p.userId) : null,
                phoneNumber: p.phoneNumber ? String(p.phoneNumber) : null,
                displayName: p.displayName ?? null,
                avatar: p.avatar ?? null,
            };
            this.displayName = this.profile.displayName;
            this.avatar = this.profile.avatar;
            this.uid = this.profile.userId;
            this.phone = this.profile.phoneNumber;

            await ZaloAccountModel.updateOne(
                { id: this.id },
                { $set: { displayName: this.profile.displayName, avatar: this.profile.avatar, uid: this.profile.userId, phone: this.profile.phoneNumber, updatedAt: new Date() } },
                { upsert: true }
            );

            // --- hợp nhất theo phone: nếu đã có account khác trùng phone -> merge id
            if (this.phone) {
                const existed = await ZaloAccountModel.findOne({ phone: this.phone, id: { $ne: this.id } }).lean();
                if (existed) {
                    // copy ctx/prof sang existed.id
                    await ZaloAccountModel.updateOne(
                        { id: existed.id },
                        {
                            $set: {
                                cookie: (await api.getCookie?.()?.toJSON?.()) ?? api.getContext().cookie,
                                imei: api.getContext().imei,
                                userAgent: api.getContext().userAgent,
                                displayName: this.displayName,
                                avatar: this.avatar,
                                uid: this.uid,
                                phone: this.phone,
                                lastLoginAt: new Date(),
                                updatedAt: new Date(),
                            }
                        },
                        { upsert: true }
                    );

                    const oldId = this.id;
                    const canonical = existed.id;

                    // move runner id trên manager
                    await this.manager.mergeRunnerId(this, canonical);

                    // xoá doc tạm id cũ
                    try { await ZaloAccountModel.deleteOne({ id: oldId }); } catch { }

                    // cập nhật proxy từ existed nếu có
                    this.proxy = existed.proxy || this.proxy || null;
                }
            }
        } catch (e) {
            console.log('[runner] fetchAccountInfo error', { id: this.id, err: e?.message });
        }
    }

    _pushMessageToBuf(message) {
        try {
            const isUser = message?.type === ThreadType.User || message?.type === 0 || message?.type === 'User';
            if (!isUser) return;
            const threadId = message.threadId; if (!threadId) return;
            const list = this._msgBuf.get(threadId) || [];
            list.push(message); if (list.length > this._bufMax) list.splice(0, list.length - this._bufMax);
            this._msgBuf.set(threadId, list);
        } catch (e) { console.log('[runner] push buf error', { id: this.id, err: e?.message }); }
    }
    getRecentMessages(threadId, limit = 50) {
        const list = this._msgBuf.get(threadId) || [];
        if (limit <= 0 || limit >= list.length) return list.slice();
        return list.slice(list.length - limit);
    }

    async _upsertThreadOnMessage(msg, { name, avatar } = {}) {
        const setObj = {
            updatedAt: new Date(),
            lastMessageAt: msg.ts,
            lastMessageText: msg.text || (msg.contentType === 'file' ? '[Tệp]' : msg.contentType === 'image' ? '[Ảnh]' : '[Tin nhắn]'),
            lastMessageType: msg.contentType,
            lastMessageFrom: msg.direction
        };
        if (name) setObj.name = name;
        if (avatar) setObj.avatar = avatar;

        const incObj = {};
        if (msg.direction === 'in') incObj.unread = 1;

        await ZaloThreadModel.updateOne(
            { accountId: this.id, threadId: msg.threadId },
            { $set: setObj, ...(Object.keys(incObj).length ? { $inc: incObj } : {}) },
            { upsert: true }
        );
    }

    async _persistIncoming(m) {
        const n = normalizeIncomingMessage(m);
        n.accountId = this.id;

        const filter = n.msgId ? { accountId: this.id, msgId: n.msgId }
            : { accountId: this.id, cliMsgId: n.cliMsgId || `${+n.ts}-${Math.random()}` };

        // lúc đầu: status uploading nếu có file/ảnh để tiến hành Drive upload
        if (n.attachments?.length) n.status = 'uploading';

        await ZaloMessageModel.updateOne(filter, { $setOnInsert: n }, { upsert: true });
        await this._upsertThreadOnMessage(n);

        this._pushMessageToBuf({ ...m, isSelf: n.isSelf, status: n.status });
        this._emit('zalo:message', { data: { ...m, isSelf: n.isSelf, status: n.status } });
        this._emit('zalo:threads:update', { accountId: this.id, threadId: n.threadId });

        // upload nền lên Drive nếu có attachments / images
        if (n.attachments?.length) this.uploadIncomingToDrive({ threadId: n.threadId, msgId: n.msgId, cliMsgId: n.cliMsgId, attachments: n.attachments }).catch(() => { });
    }

    async createPendingOutgoing({ threadId, attachments, cliMsgId }) {
        const ts = new Date();
        const create = {
            accountId: this.id,
            threadId: String(threadId),
            msgId: null,
            cliMsgId,
            direction: 'out',
            isSelf: true,
            contentType: attachments?.length ? 'file' : 'text',
            text: attachments?.length ? '[Tệp]' : '',
            attachments: (attachments || []).map(p => ({ name: path.basename(p), mime: guessMimeFromName(p), size: 0, url: '', path: p, type: IMAGE_EXT.has(path.extname(p).toLowerCase()) ? 'image' : 'file' })),
            ts,
            status: 'uploading',
            raw: { pending: true }
        };
        await ZaloMessageModel.create(create);
        await this._upsertThreadOnMessage(create);
        const fakeEvent = {
            type: ThreadType.User,
            threadId: String(threadId),
            isSelf: true,
            data: { ts: +ts, content: create.text, attachments: create.attachments, cliMsgId: create.cliMsgId, status: 'uploading' }
        };
        this._pushMessageToBuf(fakeEvent);
        this._emit('zalo:message', { data: fakeEvent });
        this._emit('zalo:threads:update', { accountId: this.id, threadId: String(threadId) });
    }

    async persistOutgoing({ threadId, text, attachments = [], ack = {}, existingCliMsgId }) {
        const ts = new Date();

        if (existingCliMsgId) {
            const n = {
                msgId: ack?.msgId ? String(ack.msgId) : undefined,
                status: attachments.length ? 'uploading' : 'delivered',
                text: text || (attachments.length ? '[Tệp]' : ''),
                attachments,
                ts,
                direction: 'out',
                isSelf: true,
                contentType: attachments.length ? 'file' : 'text',
            };
            await ZaloMessageModel.updateOne({ accountId: this.id, threadId: String(threadId), cliMsgId: existingCliMsgId }, { $set: n });
            await this._upsertThreadOnMessage({ accountId: this.id, threadId: String(threadId), direction: 'out', contentType: n.contentType, text: n.text, ts });

            const data = { ts: +ts, content: n.text, attachments: n.attachments, msgId: n.msgId, cliMsgId: existingCliMsgId, status: n.status };
            this._emit('zalo:message:update', { threadId: String(threadId), data });
            return;
        }

        const create = {
            accountId: this.id,
            threadId: String(threadId),
            msgId: ack?.msgId ? String(ack.msgId) : null,
            cliMsgId: ack?.cliMsgId ? String(ack.cliMsgId) : null,
            direction: 'out',
            isSelf: true,
            contentType: attachments.length ? 'file' : 'text',
            text: text || (attachments.length ? '[Tệp]' : ''),
            attachments,
            ts,
            status: attachments.length ? 'uploading' : 'delivered',
            raw: { ack, text, attachments }
        };
        await ZaloMessageModel.create(create);
        await this._upsertThreadOnMessage(create);

        const fakeEvent = {
            type: ThreadType.User, threadId: String(threadId), isSelf: true,
            data: { ts: +ts, content: create.text, attachments: create.attachments, msgId: create.msgId, cliMsgId: create.cliMsgId, status: create.status }
        };
        this._pushMessageToBuf(fakeEvent);
        this._emit('zalo:message', { data: fakeEvent });
        this._emit('zalo:threads:update', { accountId: this.id, threadId: String(threadId) });
    }

    async resetUnread(threadId) {
        await ZaloThreadModel.updateOne({ accountId: this.id, threadId: String(threadId) }, { $set: { unread: 0, updatedAt: new Date() } });
        this._emit('zalo:threads:update', { accountId: this.id, threadId: String(threadId) });
    }

    async _onMessage(m) {
        try {
            const isUser = m?.type === ThreadType.User || m?.type === 0 || m?.type === 'User';
            if (!isUser) return;
            await this._persistIncoming(m);
        } catch (e) { console.log('[runner] persist incoming error', { id: this.id, err: e?.message }); }
    }

    async loginByQR({ userAgent, proxy } = {}) {
        this.proxy = proxy || this.proxy || null;

        const tmpDir = path.join(process.cwd(), 'tmp-qr');
        await fs.promises.mkdir(tmpDir, { recursive: true });
        const qrPath = path.join(tmpDir, `${this.id}.png`);
        try { await fs.promises.unlink(qrPath); } catch { }

        const qrTask = this._waitAndEmitQR(qrPath);

        const zalo = new Zalo(this._buildZaloOptions(this.proxy));
        this._zalo = zalo;
        const api = await zalo.loginQR({ userAgent: userAgent || '', qrPath });
        this.api = api;

        try { await qrTask; } catch { }
        await this._saveCtx(api);
        await this._saveProfile(api);

        this.status = 'online';
        this._emit('zalo:online', { displayName: this.profile?.displayName, avatar: this.profile?.avatar, uid: this.profile?.userId, phone: this.profile?.phoneNumber });

        try { api.listener.on('message', (m) => this._onMessage(m)); api.listener.start(); } catch (e) { console.log('[runner] listener error', { id: this.id, err: e?.message }); }
        return api;
    }

    async loginByCookie({ cookie, imei, userAgent, proxy } = {}) {
        this.proxy = proxy || this.proxy || null;
        const zalo = new Zalo(this._buildZaloOptions(this.proxy));
        this._zalo = zalo;
        const api = await zalo.login({ cookie, imei, userAgent });
        this.api = api;

        await this._saveCtx(api);
        await this._saveProfile(api);

        this.status = 'online';
        this._emit('zalo:online', { displayName: this.profile?.displayName, avatar: this.profile?.avatar, uid: this.profile?.userId, phone: this.profile?.phoneNumber });

        try { api.listener.on('message', (m) => this._onMessage(m)); api.listener.start(); } catch (e) { console.log('[runner] listener error (cookie)', { id: this.id, err: e?.message }); }
        return api;
    }

    async logout() {
        try { await this.api?.listener?.stop?.(); } catch { }
        this.api = null;
        this.status = 'offline';
        this._emit('zalo:offline');
    }

    // ------- UPLOAD DRIVE (INCOMING & OUTGOING) --------
    async uploadIncomingToDrive({ threadId, msgId, cliMsgId, attachments }) {
        try {
            const files = [];
            for (const a of attachments) {
                let buffer = null; let name = a.name || 'file';
                if (a.path) buffer = await fs.promises.readFile(a.path);
                else if (a.url) {
                    const r = await fetch(a.url); const arr = await r.arrayBuffer(); buffer = Buffer.from(arr);
                    // name từ url nếu có
                    try { const u = new URL(a.url); const base = path.basename(u.pathname); if (base) name = base; } catch { }
                }
                if (!buffer) continue;

                const mime = a.mime || guessMimeFromName(name);
                const info = await uploadBufferToDrive({ name, mime, buffer });

                files.push({
                    ...a,
                    driveId: info.id,
                    viewLink: info.webViewLink,
                    downloadLink: info.webContentLink,
                    thumbnailLink: info.thumbnailLink || undefined,
                    type: a.type || (mime.startsWith('image/') ? 'image' : 'file')
                });
            }

            // patch DB + emit update
            const q = msgId ? { accountId: this.id, msgId } : { accountId: this.id, cliMsgId };
            await ZaloMessageModel.updateOne(q, { $set: { attachments: files, status: 'delivered', contentType: files.some(x => x.type === 'image') ? 'image' : 'file' } });
            this._emit('zalo:message:update', { threadId: String(threadId), data: { cliMsgId, msgId, attachments: files, status: 'delivered' } });
        } catch (e) {
            console.log('[runner] uploadIncomingToDrive error', { id: this.id, err: e?.message });
        }
    }

    async uploadOutgoingToDrive({ threadId, attachments, ack }) {
        try {
            const files = [];
            for (const p of attachments) {
                const name = path.basename(p);
                const mime = guessMimeFromName(name);
                const buffer = await fs.promises.readFile(p);
                const info = await uploadBufferToDrive({ name, mime, buffer });

                files.push({
                    name, mime, size: buffer.length,
                    path: p, url: '', type: mime.startsWith('image/') ? 'image' : 'file',
                    driveId: info.id, viewLink: info.webViewLink, downloadLink: info.webContentLink, thumbnailLink: info.thumbnailLink || undefined
                });

                // optionally clean temp uploads
                try { await fs.promises.unlink(p); } catch { }
            }

            const q = ack?.msgId ? { accountId: this.id, msgId: String(ack.msgId) } : (ack?.cliMsgId ? { accountId: this.id, cliMsgId: String(ack.cliMsgId) } : null);
            if (q) {
                await ZaloMessageModel.updateOne(q, { $set: { attachments: files, status: 'delivered', contentType: files.some(x => x.type === 'image') ? 'image' : 'file' } });
                this._emit('zalo:message:update', { threadId: String(threadId), data: { msgId: String(ack?.msgId || ''), cliMsgId: String(ack?.cliMsgId || ''), attachments: files, status: 'delivered' } });
            }
        } catch (e) {
            console.log('[runner] uploadOutgoingToDrive error', { id: this.id, err: e?.message });
        }
    }
}
