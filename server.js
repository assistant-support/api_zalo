import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
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

    io.on('connection', (socket) => {
        console.log('A client connected:', socket.id);
        socket.emit('login_status', { isLoggedIn: !!globalThis.zaloApi });

        socket.on('request_qr_login', () => {
            console.log(`Client ${socket.id} is requesting a QR login.`);
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