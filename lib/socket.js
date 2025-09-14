// /lib/socket.js
import { Server as IOServer } from 'socket.io';
import { getToken } from 'next-auth/jwt';

let ioRef = null;

function hasPerm(user, action) {
    if (user?.isAdmin) return true;
    return (user?.perms || []).some((p) => p.action === action);
}

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
        pingInterval: 25_000,
        pingTimeout: 20_000,
        maxHttpBufferSize: 256 * 1024,
    });

    // Xác thực nhẹ bằng next-auth token (nếu có)
    io.use(async (socket, next) => {
        try {
            const req = socket.request;
            const token = await getToken({
                req,
                secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
            });
            if (token) {
                socket.user = {
                    id: token.uid,
                    isAdmin: !!token.isAdmin,
                    perms: Array.isArray(token.perms) ? token.perms : [],
                };
            } else {
                socket.user = null;
            }
            next();
        } catch (e) {
            next(e);
        }
    });

    io.on('connection', (socket) => {
        socket.on('join', (room) => {
            if (typeof room !== 'string' || !room) return;

            // Chặn phòng nhạy cảm
            if (room.startsWith('room:user:')) {
                const uid = room.split(':').at(-1);
                if (!socket.user || String(socket.user.id) !== String(uid)) return;
            }
            if (room === 'room:users' && !hasPerm(socket.user, 'user:list')) return;
            if (room === 'room:roles' && !hasPerm(socket.user, 'role:list')) return;
            if (room === 'room:permissions' && !hasPerm(socket.user, 'permission:list')) return;

            socket.join(room);
            socket.emit('joined', room);
        });

        socket.on('leave', (room) => {
            if (typeof room === 'string' && room) socket.leave(room);
        });

        socket.on('ping', () => socket.emit('pong'));
    });

    ioRef = io;
    globalThis.__io = io;
    return io;
}

export function getIO() {
    return ioRef || globalThis.__io || null;
}
