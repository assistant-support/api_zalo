import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { handleQrLogin, handleLogout, findUserByPhone, sendMessage, checkSessionStatus } from './lib/zalo-bot.js';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res, parse(req.url, true));
    });

    const io = new Server(httpServer);

    io.on('connection', (socket) => {
        console.log('A client connected:', socket.id);
        socket.emit('login_status', { isLoggedIn: !!globalThis.zaloApi });
        if (globalThis.zaloApi) {
            socket.emit('initial_state', { conversations: globalThis.conversations, userInfo: globalThis.userInfoCache });
        }

        socket.on('request_qr_login', () => handleQrLogin(io, socket));
        socket.on('request_logout', () => handleLogout(io));

        socket.on('search_user', async (phone, callback) => {
            const result = await findUserByPhone(phone);
            callback(result);
        });

        socket.on('send_message', async (payload, callback) => {
            const result = await sendMessage(payload.threadId, payload.text);
            callback(result);
        });

        socket.on('disconnect', () => console.log('A client disconnected:', socket.id));
    });

    // Bắt đầu vòng lặp kiểm tra sức khỏe phiên đăng nhập mỗi 3 phút
    console.log('Starting session health check loop (every 3 minutes)...');
    setInterval(() => {
        checkSessionStatus(io);
    }, 180000); // 180000ms = 3 phút

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});