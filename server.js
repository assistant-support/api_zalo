import 'dotenv/config';
import next from 'next';
import { createServer } from 'http';
import { randomBytes } from 'crypto';
import { pathToFileURL } from 'url';
import fs from 'node:fs';
import path from 'node:path';

import { connectMongo, disconnectMongo } from './lib/db_connect.js';
import { createSocketServer } from './lib/socket.js';
import { ZaloManager } from './lib/zalo_manager.js';
import { ZaloAccountModel } from './models/zalo-session.model.js';
import { ProxyModel } from './models/proxy.model.js';
import { testProxyUrl } from './lib/proxy.js';

const DEV = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
    console.log('[server] starting...', { env: DEV ? 'dev' : 'prod', port: PORT });

    // Node polyfills
    try {
        if (!globalThis.crypto?.subtle) {
            const { webcrypto } = await import('crypto'); globalThis.crypto = webcrypto;
        }
    } catch { }
    try {
        if (typeof fetch === 'undefined') {
            const { default: nodeFetch } = await import('node-fetch'); globalThis.fetch = nodeFetch;
        }
    } catch { }

    if (!process.env.NEXTAUTH_URL) console.warn('[server] NEXTAUTH_URL missing');
    if (!process.env.NEXTAUTH_SECRET) console.warn('[server] NEXTAUTH_SECRET missing');

    const app = next({ dev: DEV, hostname: HOST, port: PORT });
    const handle = app.getRequestHandler();
    await app.prepare();

    await connectMongo();

    const server = createServer(async (req, res) => {
        // health
        if (req.url === '/health') {
            res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return;
        }

        // ----- ZALO REST -----
        if (req.url?.startsWith('/zalo/')) {
            try {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const pathname = url.pathname;
                const [, , id, action, sub] = pathname.split('/'); // /zalo/:id/login/qr

                if (req.method === 'GET' && /^\/zalo\/[^/]+$/.test(pathname)) return handle(req, res);

                // lazy body
                let json = {};
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const chunks = []; for await (const c of req) chunks.push(c);
                    const bodyText = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
                    json = bodyText ? JSON.parse(bodyText) : {};
                }

                // POST /zalo/login/qr  (tạo id ngẫu nhiên)
                if (pathname === '/zalo/login/qr' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    const genId = 'acc_' + randomBytes(3).toString('hex');
                    console.log('[http] create QR (no id) ->', genId);
                    await ZaloManager.instance().loginQR(genId);
                    res.end(JSON.stringify({ ok: true, id: genId })); return;
                }

                // GET /zalo/sessions  (fallback DB nếu runners rỗng)
                if (pathname === '/zalo/sessions' && req.method === 'GET') {
                    res.setHeader('content-type', 'application/json');
                    let data = await ZaloManager.instance().listSessions();
                    if (!Array.isArray(data) || data.length === 0) {
                        const rows = await ZaloAccountModel.find({}, {
                            id: 1, displayName: 1, avatar: 1, uid: 1, phone: 1, lastLoginAt: 1, proxy: 1
                        }).lean();
                        data = rows.map(r => ({ ...r, status: 'offline' }));
                    }
                    res.end(JSON.stringify({ ok: true, data })); return;
                }

                // POST /zalo/:id/login/qr
                if (action === 'login' && sub === 'qr' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    console.log('[http] login QR by id ->', id);
                    await ZaloManager.instance().loginQR(id);
                    res.end(JSON.stringify({ ok: true })); return;
                }

                // POST /zalo/:id/login/cookie
                if (action === 'login' && sub === 'cookie' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    const { cookie, imei, userAgent } = json || {};
                    await ZaloManager.instance().loginCookie(id, { cookie, imei, userAgent });
                    res.end(JSON.stringify({ ok: true })); return;
                }

                // POST /zalo/:id/proxy
                if (action === 'proxy' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    const { proxy } = json || {};
                    await ZaloManager.instance().setProxy(id, proxy || null);
                    res.end(JSON.stringify({ ok: true })); return;
                }

                // POST /zalo/:id/logout
                if (action === 'logout' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    await ZaloManager.instance().logout(id);
                    res.end(JSON.stringify({ ok: true })); return;
                }

                return handle(req, res);
            } catch (e) {
                console.error('[http] /zalo error:', e?.message || e);
                res.statusCode = 500;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: e?.message || String(e) }));
                return;
            }
        }

        // ----- PROXY REST -----
        if (req.url?.startsWith('/proxy')) {
            try {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const pathname = url.pathname;

                // parse body
                let json = {};
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const chunks = []; for await (const c of req) chunks.push(c);
                    const bodyText = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
                    json = bodyText ? JSON.parse(bodyText) : {};
                }

                // GET /proxy/list
                if (pathname === '/proxy/list' && req.method === 'GET') {
                    res.setHeader('content-type', 'application/json');
                    const proxies = await ProxyModel.find({}).sort({ createdAt: -1 }).lean();
                    const accounts = await ZaloAccountModel.find({}, { id: 1, displayName: 1, phone: 1, proxy: 1 }).lean();
                    res.end(JSON.stringify({ ok: true, proxies, accounts })); return;
                }

                // POST /proxy/create { url, label }
                if (pathname === '/proxy/create' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    const { url: pUrl, label } = json || {};
                    if (!pUrl) throw new Error('proxy url required');
                    const doc = await ProxyModel.create({ url: pUrl.trim(), label: (label || '').trim() || null });
                    res.end(JSON.stringify({ ok: true, data: doc })); return;
                }

                // POST /proxy/test { url }  (không bắt buộc nằm trong DB)
                if (pathname === '/proxy/test' && req.method === 'POST') {
                    res.setHeader('content-type', 'application/json');
                    const { url: pUrl } = json || {};
                    if (!pUrl) throw new Error('proxy url required');
                    const r = await testProxyUrl(pUrl);
                    res.end(JSON.stringify({ ok: !!r.ok, data: r })); return;
                }

                // DELETE /proxy/:id
                const m = pathname.match(/^\/proxy\/([^/]+)$/);
                if (m && req.method === 'DELETE') {
                    res.setHeader('content-type', 'application/json');
                    await ProxyModel.deleteOne({ _id: m[1] });
                    res.end(JSON.stringify({ ok: true })); return;
                }

                return handle(req, res);
            } catch (e) {
                console.error('[http] /proxy error:', e?.message || e);
                res.statusCode = 500;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: e?.message || String(e) }));
                return;
            }
        }

        // default next
        return handle(req, res);
    });

    // Socket.IO
    const io = createSocketServer(server);
    await ZaloManager.instance().bootstrap(io);

    io.on('connection', (socket) => {
        console.log('[socket] connected', socket.id);

        socket.emit('zalo:sessions', ZaloManager.instance().publicState());

        socket.on('zalo:login:qr', async (id) => {
            try {
                if (id) await ZaloManager.instance().loginQR(id);
                else {
                    const newId = 'acc_' + randomBytes(3).toString('hex');
                    await ZaloManager.instance().loginQR(newId);
                    socket.emit('zalo:qr:created', { id: newId });
                }
            } catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'login qr error' }); }
        });

        socket.on('zalo:login:cookie', async ({ id, cookie, imei, userAgent }) => {
            try { await ZaloManager.instance().loginCookie(id, { cookie, imei, userAgent }); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'login cookie error' }); }
        });

        socket.on('zalo:logout', async (id) => {
            try { await ZaloManager.instance().logout(id); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'logout error' }); }
        });

        socket.on('zalo:setProxy', async ({ id, proxy }) => {
            try { await ZaloManager.instance().setProxy(id, proxy || null); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'set proxy error' }); }
        });

        // Threads / messages
        socket.on('zalo:friends', async ({ id }) => {
            try { const data = await ZaloManager.instance().getFriends(id); socket.emit('zalo:friends:ok', { id, data }); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'get friends failed' }); }
        });

        socket.on('zalo:findUser', async ({ id, phone }) => {
            try { const data = await ZaloManager.instance().findUser(id, phone); socket.emit('zalo:findUser:ok', { id, data }); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'find user failed' }); }
        });

        socket.on('zalo:threads', async ({ id }) => {
            try { const data = await ZaloManager.instance().getThreads(id, { limit: 200 }); socket.emit('zalo:threads:ok', { id, data }); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'get threads failed' }); }
        });

        socket.on('zalo:history', async ({ id, threadId, limit = 60, beforeTs }) => {
            try { const data = await ZaloManager.instance().getMessages(id, threadId, { limit, beforeTs }); socket.emit('zalo:history:ok', { id, threadId, data }); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'load history failed' }); }
        });

        socket.on('zalo:thread:seen', async ({ id, threadId }) => {
            try { await ZaloManager.instance().markThreadSeen(id, threadId); }
            catch { }
        });

        socket.on('zalo:send:text', async ({ id, threadId, text }) => {
            try { await ZaloManager.instance().sendText(id, threadId, text); }
            catch (e) { socket.emit('zalo:error', { id, message: e?.message || 'send text failed' }); }
        });

        socket.on('zalo:send:file', async (payload) => {
            try {
                const { id, threadId, filename, fileBuffer } = payload || {};
                if (!id || !threadId || !filename || !fileBuffer) throw new Error('invalid payload');

                const dir = path.join(process.cwd(), 'tmp-upload', id);
                await fs.promises.mkdir(dir, { recursive: true });
                const fullPath = path.join(dir, `${Date.now()}_${filename}`);

                const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(new Uint8Array(fileBuffer));
                await fs.promises.writeFile(fullPath, buf);

                await ZaloManager.instance().sendAttachments(id, threadId, [fullPath]);
            } catch (e) {
                socket.emit('zalo:error', { id: payload?.id, message: e?.message || 'send file failed' });
            }
        });

        socket.on('disconnect', (reason) => console.log('[socket] disconnected', socket.id, reason));
    });

    server.listen(PORT, HOST, () => console.log('[server] ready ->', `http://${HOST}:${PORT}`));

    // graceful shutdown
    const shutdown = async (signal) => {
        console.warn('[server] shutdown', signal);
        await new Promise((resolve) => globalThis.__io?.close(resolve));
        try { await ZaloManager.instance().shutdownAll(); } catch (e) { console.warn('[server] shutdown zalo error:', e?.message || e); }
        try { await disconnectMongo(); console.log('[server] mongo closed'); } catch (e) { console.warn('[server] mongo close error:', e?.message || e); }
        server.close(() => { console.log('[server] http closed'); process.exit(0); });
        setTimeout(() => process.exit(1), 7000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (r) => console.error('[server] unhandledRejection', r));
    process.on('uncaughtException', (e) => console.error('[server] uncaughtException', e));
}

const isEntry = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) start().catch((err) => { console.error('[server] fatal startup', err); process.exit(1); });

export { connectMongo } from './lib/db_connect.js';
export { getIO } from './lib/socket.js';
