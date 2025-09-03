import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
// Chỉ import hàm xử lý, không chạy nó ngay
import { handleQrLogin } from './lib/zalo-bot.js';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer);

    // Lắng nghe sự kiện kết nối từ các client
    io.on('connection', (socket) => {
        console.log('A client connected:', socket.id);

        // Gửi trạng thái đăng nhập hiện tại cho client vừa kết nối
        socket.emit('login_status', { isLoggedIn: !!globalThis.zaloApi });

        // Lắng nghe sự kiện yêu cầu đăng nhập QR từ client
        socket.on('request_qr_login', () => {
            console.log(`Client ${socket.id} is requesting a QR login.`);
            // Gọi hàm xử lý đăng nhập
            handleQrLogin(io, socket);
        });

        socket.on('disconnect', () => {
            console.log('A client disconnected:', socket.id);
        });
    });

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});