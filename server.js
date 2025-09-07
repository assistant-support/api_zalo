// server.js
import 'dotenv/config';
import next from 'next';
import { createServer } from 'http';
import { connectMongo, disconnectMongo } from './lib/db_connect.js';
import { createSocketServer } from './lib/socket.js';
import { pathToFileURL } from 'url';

const DEV = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
    // guard crypto subtle (hiếm khi cần)
    try {
        if (!globalThis.crypto?.subtle) {
            const { webcrypto } = await import('crypto');
            globalThis.crypto = webcrypto;
        }
    } catch { }

    if (!process.env.NEXTAUTH_URL) {
        console.warn('[auth] Missing NEXTAUTH_URL (vd http://localhost:3000)');
    }
    if (!process.env.NEXTAUTH_SECRET) {
        console.warn('[auth] Missing NEXTAUTH_SECRET (tạo chuỗi 32+ bytes)');
    }

    const app = next({ dev: DEV, hostname: HOST, port: PORT });
    const handle = app.getRequestHandler();
    await app.prepare();

    // kết nối DB trước khi nhận request
    await connectMongo();

    const server = createServer(async (req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }
        return handle(req, res);
    });

    // gắn Socket.IO
    createSocketServer(server);

    server.listen(PORT, HOST, () => {
        console.log(`> Ready on http://${HOST}:${PORT} (env=${DEV ? 'dev' : 'prod'})`);
    });

    const shutdown = async (signal) => {
        console.log(`\n[sys] ${signal} received. Shutting down...`);
        // đóng socket.io
        await new Promise((resolve) => globalThis.__io?.close(resolve));
        // đóng mongo
        try {
            await disconnectMongo();
            console.log('[mongo] connection closed');
        } catch (e) {
            console.warn('[mongo] close error:', e);
        }
        // đóng http
        server.close(() => {
            console.log('[http] server closed');
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 7000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (r) => console.error('[sys] Unhandled Rejection:', r));
    process.on('uncaughtException', (e) => console.error('[sys] Uncaught Exception:', e));
}

const isEntry = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
    start().catch((err) => {
        console.error('[sys] Fatal startup error:', err);
        process.exit(1);
    });
}

// Helpers (nếu bạn muốn import từ nơi khác)
export { connectMongo } from './lib/db_connect.js';
export { getIO } from './lib/socket.js';
