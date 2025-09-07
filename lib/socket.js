// lib/socket.js (ESM, KHÔNG default export)
import { Server as IOServer } from 'socket.io';
import { getToken } from 'next-auth/jwt';

let ioRef = null;

/**
 * Tạo/gắn Socket.IO vào HTTP server (idempotent).
 * Luôn export dạng NAMED để khớp với:
 *   import { createSocketServer, getIO } from './lib/socket.js'
 */
export function createSocketServer(server) {
    if (ioRef) return ioRef; // đã khởi tạo

    const io = new IOServer(server, {
        path: '/socket.io',
        serveClient: false,
        cors: {
            origin: process.env.SOCKET_CORS_ORIGIN
                ? process.env.SOCKET_CORS_ORIGIN.split(',').map((s) => s.trim())
                : true,
            credentials: true,
        },
        connectTimeout: 45_000,
        pingInterval: 25_000,
        pingTimeout: 20_000,
    });

    // (tuỳ chọn) bắt buộc đăng nhập bằng NextAuth JWT cho socket
    if (String(process.env.SOCKET_REQUIRE_AUTH || 'false') === 'true') {
        io.use(async (socket, next) => {
            try {
                const token = await getToken({
                    req: { headers: { cookie: socket.request.headers.cookie || '' } },
                    secret: process.env.NEXTAUTH_SECRET,
                });
                if (!token) return next(new Error('unauthorized'));
                socket.data.user = token;
                next();
            } catch (e) {
                next(e);
            }
        });
    }

    io.on('connection', (socket) => {
        console.log('[socket] connected:', socket.id);

        socket.on('join', (room) => {
            if (typeof room === 'string' && room) {
                socket.join(room);
                socket.emit('joined', room);
            }
        });

        socket.on('ping', () => socket.emit('pong'));
        socket.on('disconnect', (reason) => {
            console.log('[socket] disconnected:', socket.id, reason);
        });
    });

    // giữ tham chiếu cục bộ & global để tái sử dụng ở nơi khác
    ioRef = io;
    globalThis.__io = io;
    return io;
}

/** Lấy lại instance IO ở mọi nơi (server actions/route handlers) */
export function getIO() {
    return ioRef || globalThis.__io || null;
}
