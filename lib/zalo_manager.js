// /lib/zalo_manager.js
import { ZaloRunner } from './zalo_runner.js';
import { ZaloAccountModel } from '../models/zalo-session.model.js';
import { ZaloThreadModel } from '../models/zalo-thread.model.js';
import { ZaloMessageModel } from '../models/zalo-message.model.js';

export class ZaloManager {
    static _inst = null;
    static instance() { if (!this._inst) this._inst = new ZaloManager(); return this._inst; }

    constructor() { this.runners = new Map(); this.io = null; }
    attachIO(io) { this.io = io; }

    _getOrCreate(id) {
        let r = this.runners.get(id);
        if (!r) { r = new ZaloRunner(id, this.io, this); this.runners.set(id, r); }
        return r;
    }

    async bootstrap(io) {
        this.attachIO(io);
        console.log('[manager] bootstrap: restore accounts from DB');
        const accounts = await ZaloAccountModel.find({}, {
            id: 1, cookie: 1, imei: 1, userAgent: 1, proxy: 1,
            displayName: 1, avatar: 1, uid: 1, phone: 1, lastLoginAt: 1
        }).lean();
        console.log('[manager] accounts found', accounts.length);

        for (const a of accounts) {
            try {
                const r = this._getOrCreate(a.id);
                r.proxy = a.proxy || null;
                r.displayName = a.displayName || null;
                r.avatar = a.avatar || null;
                r.uid = a.uid || null;
                r.phone = a.phone || null;
                r.lastLoginAt = a.lastLoginAt || null;

                if (a.cookie && a.imei && a.userAgent) {
                    await r.loginByCookie({ cookie: a.cookie, imei: a.imei, userAgent: a.userAgent, proxy: a.proxy });
                } else {
                    console.log('[manager] skip auto login (missing cookie/imei/ua)', { id: a.id });
                }
            } catch (e) {
                console.log('[manager] auto login error', { id: a.id, err: e?.message });
                this.io?.emit('zalo:error', { id: a.id, message: e?.message || 'auto login fail' });
            }
        }
    }

    publicState() {
        return [...this.runners.entries()].map(([id, r]) => ({
            id, status: r.status, displayName: r.displayName || null, avatar: r.avatar || null,
            uid: r.uid || null, phone: r.phone || null, lastLoginAt: r.lastLoginAt || null, proxy: r.proxy || null
        }));
    }
    async listSessions() { return this.publicState(); }

    async loginQR(id) {
        const r = this._getOrCreate(id);
        await r.loginByQR({});
        return true;
    }
    async loginCookie(id, { cookie, imei, userAgent } = {}) {
        const r = this._getOrCreate(id);
        await r.loginByCookie({ cookie, imei, userAgent, proxy: r.proxy });
        return true;
    }

    async logout(id) { const r = this._getOrCreate(id); await r.logout(); return true; }

    async shutdownAll() {
        console.log('[manager] shutdownAll', { count: this.runners.size });
        for (const [, r] of this.runners) { try { await r.logout(); } catch { } }
    }

    async setProxy(id, proxy) {
        await ZaloAccountModel.updateOne({ id }, { $set: { proxy } }, { upsert: true });
        const r = this._getOrCreate(id); r.proxy = proxy;
        this.io?.emit('zalo:proxy:set', { id, proxy });
    }

    async getFriends(id) { const r = this._getOrCreate(id); if (!r.api) throw new Error('account not online'); return r.api.getAllFriends(); }
    async findUser(id, phone) { const r = this._getOrCreate(id); if (!r.api) throw new Error('account not online'); return r.api.findUser(phone); }

    async getRecentMessages(id, threadId, limit = 50) { return this._getOrCreate(id).getRecentMessages(threadId, limit); }

    async getThreads(id, { limit = 100 } = {}) {
        return ZaloThreadModel.find({ accountId: id }).sort({ pinned: -1, lastMessageAt: -1 }).limit(limit).lean();
    }
    async getMessages(id, threadId, { limit = 60, beforeTs } = {}) {
        const q = { accountId: id, threadId: String(threadId) };
        if (beforeTs) q.ts = { $lt: new Date(Number(beforeTs)) };
        const list = await ZaloMessageModel.find(q).sort({ ts: -1 }).limit(limit).lean();
        return list.reverse();
    }
    async markThreadSeen(id, threadId) { const r = this._getOrCreate(id); await r.resetUnread(threadId); }

    async sendText(id, threadId, text, opts) {
        const r = this._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        const ack = await r.api.sendMessage({ msg: text, ...opts }, threadId);
        await r.persistOutgoing({ threadId, text, attachments: [], ack });
        return ack;
    }
    async sendAttachments(id, threadId, paths) {
        const r = this._getOrCreate(id);
        if (!r.api) throw new Error('account not online');

        // tạo bubble "uploading" trước
        const pendingCli = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await r.createPendingOutgoing({ threadId, attachments: paths, cliMsgId: pendingCli });

        const ack = await r.api.sendMessage({ msg: '', attachments: paths }, threadId);
        await r.persistOutgoing({ threadId, text: '', attachments: paths, ack, existingCliMsgId: pendingCli });

        // upload lên Drive + patch
        r.uploadOutgoingToDrive({ threadId, attachments: paths, ack }).catch(() => { });
        return ack;
    }

    async unreadTotalForAccount(id) {
        const [r] = await ZaloThreadModel.aggregate([{ $match: { accountId: id, unread: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$unread' } } }]);
        return r?.total || 0;
    }
    async unreadTotalsAllAccounts() {
        const rows = await ZaloThreadModel.aggregate([{ $match: { unread: { $gt: 0 } } }, { $group: { _id: '$accountId', total: { $sum: '$unread' } } }]);
        const out = {}; for (const r of rows) out[r._id] = r.total; return out;
    }
    async unreadPerThread(id) {
        return (await ZaloThreadModel.find({ accountId: id, unread: { $gt: 0 } }, { threadId: 1, unread: 1 }).lean());
    }

    // ---- hợp nhất runner id khi phát hiện cùng phone ----
    async mergeRunnerId(runner, canonicalId) {
        const fromId = runner.id;
        if (fromId === canonicalId) return;

        const existed = this.runners.get(canonicalId);
        if (existed && existed !== runner) { try { await existed.logout(); } catch { } }

        // move map key
        this.runners.delete(fromId);
        runner.id = canonicalId;
        this.runners.set(canonicalId, runner);

        this.io?.emit('zalo:merged', { from: fromId, to: canonicalId });
        // cập nhật sessions realtime
        this.io?.emit('zalo:online', {
            id: canonicalId,
            displayName: runner.displayName, avatar: runner.avatar,
            uid: runner.uid, phone: runner.phone, lastLoginAt: runner.lastLoginAt
        });
    }
}
