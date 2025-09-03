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
    // --- LOG: Server chuẩn bị xong ---
    console.log('[SERVER] Next.js app prepared. Setting up HTTP and Socket.IO server...');
    
    const httpServer = createServer((req, res) => {
        handle(req, res, parse(req.url, true));
    });

    const io = new Server(httpServer);
    
    // --- LOG: Socket.IO sẵn sàng ---
    console.log('[SERVER] Socket.IO server initialized and listening for connections.');

    io.on('connection', (socket) => {
        // --- LOG: Client mới kết nối ---
        console.info(`[SOCKET.IO] ✅ Client connected: ${socket.id}`);

        const isLoggedIn = !!globalThis.zaloApi;
        
        // --- LOG: Gửi trạng thái đăng nhập ban đầu ---
        console.log(`[SOCKET.IO] ⬅️ Emitting 'login_status' to ${socket.id}. Status: ${isLoggedIn}`);
        socket.emit('login_status', { isLoggedIn });

        if (isLoggedIn) {
            // --- LOG: Gửi dữ liệu ban đầu nếu đã đăng nhập ---
            console.log(`[SOCKET.IO] ⬅️ Emitting 'initial_state' to ${socket.id}.`);
            socket.emit('initial_state', { conversations: globalThis.conversations, userInfo: globalThis.userInfoCache });
        }

        socket.on('request_qr_login', () => {
            // --- LOG: Nhận được yêu cầu đăng nhập QR ---
            console.log(`[SOCKET.IO] ➡️ Received 'request_qr_login' from ${socket.id}.`);
            handleQrLogin(io, socket);
        });

        socket.on('request_logout', () => {
            // --- LOG: Nhận được yêu cầu đăng xuất ---
            console.log(`[SOCKET.IO] ➡️ Received 'request_logout' from ${socket.id}.`);
            handleLogout(io);
        });

        socket.on('search_user', async (phone, callback) => {
            // --- LOG: Nhận được yêu cầu tìm người dùng ---
            console.log(`[SOCKET.IO] ➡️ Received 'search_user' from ${socket.id} with phone: ${phone}`);
            const result = await findUserByPhone(phone);
            // --- LOG: Trả kết quả tìm kiếm về cho client ---
            console.log(`[SOCKET.IO] ⬅️ Sending 'search_user' callback to ${socket.id} with result:`, result);
            callback(result);
        });

        socket.on('send_message', async (payload, callback) => {
            // --- LOG: Nhận được yêu cầu gửi tin nhắn ---
            console.log(`[SOCKET.IO] ➡️ Received 'send_message' from ${socket.id} to thread: ${payload.threadId}`);
            const result = await sendMessage(payload.threadId, payload.text);
            // --- LOG: Trả kết quả gửi tin nhắn về cho client ---
            console.log(`[SOCKET.IO] ⬅️ Sending 'send_message' callback to ${socket.id} with result:`, result);
            callback(result);
        });

        socket.on('disconnect', () => {
            // --- LOG: Client ngắt kết nối ---
            console.warn(`[SOCKET.IO] ❌ Client disconnected: ${socket.id}`);
        });
    });

    // Bắt đầu vòng lặp kiểm tra sức khỏe phiên đăng nhập mỗi 3 phút
    console.log('[SERVER] Starting session health check loop (every 3 minutes)...');
    setInterval(() => {
        // --- LOG: Chạy kiểm tra định kỳ ---
        console.log('[HEALTH CHECK] Running periodic session status check...');
        checkSessionStatus(io);
    }, 180000); // 180000ms = 3 phút

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});