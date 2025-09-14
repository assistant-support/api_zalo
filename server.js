// server.js
import 'dotenv/config';
import next from 'next';
import { createServer } from 'http';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';

import { connectMongo, disconnectMongo } from './lib/db_connect.js';
import { createSocketServer, getIO } from './lib/socket.js';

// Đảm bảo model được đăng ký với Mongoose (nếu bạn dùng Model thay vì collection thô)
import './models/realtime-message.model.js';

const DEV = process.env.NODE_ENV !== 'production';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4002);

async function start() {
    console.log('[server] booting…', { env: DEV ? 'dev' : 'prod', port: PORT });

    // 1) Kết nối Mongo 1 lần cho toàn process
    await connectMongo();

    // 2) Next app + HTTP server (chung 1 cổng với Socket.IO)
    const app = next({ dev: DEV, hostname: HOST, port: PORT });
    const handle = app.getRequestHandler();
    await app.prepare();

    const server = createServer((req, res) => {
        if (req.url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
        return handle(req, res);
    });

    // 3) Tạo Socket.IO 1 lần (singleton)
    const io = createSocketServer(server);

    // 4) GẮN REALTIME TỪ MONGO → SOCKET (Change Streams 1 watcher/collection)
    //    - Không cần cache: client nhận sự kiện trực tiếp qua socket
    //    - Room quy ước: `room:<roomKey>` (nếu doc có "room"), fallback `room:public`
    if (!globalThis.__rtWatcher) {
        try {
            const coll = mongoose.connection.collection('realtime_messages'); // tên collection
            const cs = coll.watch([], { fullDocument: 'updateLookup' });

            cs.on('change', (evt) => {
                const doc = evt.fullDocument;
                const room = doc?.room ? `room:${doc.room}` : 'room:public';
                // Đẩy sự kiện (type: insert/update/delete) + nội dung doc mới
                io.to(room).emit('rt:message', { type: evt.operationType, doc });
            });

            cs.on('error', (e) => console.error('[change-stream] error', e));
            globalThis.__rtWatcher = cs;
        } catch (e) {
            console.warn('[change-stream] not enabled (need Replica Set/Atlas):', e?.message || e);
        }
    }

    // 5) Listen
    server.listen(PORT, HOST, () => {
        console.log('[server] ready ->', `http://${HOST}:${PORT}`);
    });

    // 6) Graceful shutdown (đóng socket, watcher, mongo, http)
    const shutdown = async (sig) => {
        console.warn('[server] shutdown', sig);
        try { await new Promise((r) => getIO()?.close(r)); } catch { }
        try { await globalThis.__rtWatcher?.close(); } catch { }
        try { await disconnectMongo(); } catch (e) { console.warn('[mongo] close error:', e?.message || e); }
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 7000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (r) => console.error('[server] unhandledRejection', r));
    process.on('uncaughtException', (e) => console.error('[server] uncaughtException', e));
}

const isEntry = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) start().catch((err) => { console.error('[server] fatal', err); process.exit(1); });

export { getIO } from './lib/socket.js';
