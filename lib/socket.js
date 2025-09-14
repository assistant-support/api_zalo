// /lib/socket.js
import { Server as IOServer } from 'socket.io';
import mongoose from 'mongoose'; // <-- thêm nếu dùng snapshot

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
        pingInterval: 25_000,
        pingTimeout: 20_000,
        maxHttpBufferSize: 256 * 1024,
    });

    io.on('connection', (socket) => {
        socket.on('join', async (room) => {
            if (typeof room !== 'string' || !room) return;
            socket.join(room);
            socket.emit('joined', room);

            // --- (tuỳ chọn) gửi SNAPSHOT khi join ---
            // room có dạng "room:<name>" -> lấy <name> để query
            const roomName = room.startsWith('room:') ? room.slice(5) : room;
            try {
                const docs = await mongoose.connection
                    .collection('realtime_messages')
                    .find({ room: roomName })
                    .sort({ ts: -1 })
                    .limit(50)
                    .toArray();
                socket.emit('rt:snapshot', docs);
            } catch (e) {
                console.warn('[socket] snapshot error:', e?.message || e);
            }
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
