import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io'; // 1. Import Server từ socket.io
import { initializeZaloBot } from './lib/zalo-bot.js';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(async () => {
    // 2. Tạo HTTP server và Socket.IO server
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer);

    // 3. Truyền instance `io` vào cho Zalo Bot để nó có thể gửi tin nhắn
    await initializeZaloBot(io);

    // 4. Lắng nghe sự kiện kết nối từ client
    io.on('connection', (socket) => {
        console.log('A client connected:', socket.id);
        socket.on('disconnect', () => {
            console.log('A client disconnected:', socket.id);
        });
    });

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});