// /lib/socket.js
import { Server as IOServer } from 'socket.io';
import { getToken } from 'next-auth/jwt';

let ioRef = null;

export function createSocketServer(server) {
    if (ioRef) return ioRef;

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
        console.log('[socket] base handler connected:', socket.id);

        socket.on('join', (room) => {
            if (typeof room === 'string' && room) {
                socket.join(room);
                socket.emit('joined', room);
                console.log('[socket] joined room', { id: socket.id, room });
            }
        });

        socket.on('ping', () => {
            socket.emit('pong');
            console.log('[socket] ping/pong', socket.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[socket] base handler disconnected:', socket.id, reason);
        });
    });

    ioRef = io;
    globalThis.__io = io;
    return io;
}

export function getIO() {
    return ioRef || globalThis.__io || null;
}
