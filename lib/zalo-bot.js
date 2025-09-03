import { Zalo, ThreadType } from "zca-js";
import fs from 'fs';
import path from 'path';

// Sử dụng globalThis để duy trì trạng thái đăng nhập ổn định trong môi trường dev
globalThis.zaloApi = null;
globalThis.receivedMessages = [];

/**
 * Xử lý yêu cầu đăng nhập bằng mã QR với đầy đủ log.
 * @param {import('socket.io').Server} io - Instance Socket.IO server.
 * @param {import('socket.io').Socket} socket - Client đã yêu cầu đăng nhập.
 */
export async function handleQrLogin(io, socket) {
    if (globalThis.zaloApi) {
        console.log("[ZALO BOT] A login session already exists.");
        socket.emit('login_status', { isLoggedIn: true });
        return;
    }

    try {
        const zalo = new Zalo();
        const qrPath = path.resolve('./qr.png');

        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath);
        }

        const qrReadyPromise = new Promise((resolve, reject) => {
            console.log('[QR STAGE] Setting up file watcher for qr.png...');

            const watcher = fs.watch(process.cwd(), (eventType, filename) => {
                if (filename === 'qr.png') {
                    console.log('[QR STAGE] Detected qr.png file event. Checking for content...');
                    watcher.close();

                    let attempts = 0;
                    const maxAttempts = 50; // Tối đa 5 giây
                    const checkInterval = setInterval(() => {
                        try {
                            const stats = fs.statSync(qrPath);
                            if (stats.size > 0) {
                                clearInterval(checkInterval);
                                console.log(`[QR STAGE] File has content (size: ${stats.size} bytes). Reading file...`);

                                const base64String = fs.readFileSync(qrPath, { encoding: 'base64' });
                                const qrCodeDataUrl = `data:image/png;base64,${base64String}`;

                                console.log(`[QR STAGE] ✅ SUCCESS: Sending Base64 QR data to client.`);
                                socket.emit('qr_code_generated', qrCodeDataUrl);
                                resolve();
                            } else if (++attempts > maxAttempts) {
                                clearInterval(checkInterval);
                                reject(new Error('QR file was created but remained empty.'));
                            }
                        } catch (err) {
                            // Bỏ qua lỗi và thử lại
                        }
                    }, 100);
                }
            });

            setTimeout(() => {
                watcher.close();
                reject(new Error('QR code generation timed out after 30 seconds.'));
            }, 30000);
        });

        console.log('[ZALO BOT] Calling zalo.loginQR() and waiting for user to scan...');
        const api = await zalo.loginQR();

        console.log('[ZALO BOT] ✅ SUCCESS: Login promise resolved. User has scanned the QR.');
        globalThis.zaloApi = api;
        io.emit('login_status', { isLoggedIn: true });

        const targetUserId = process.env.ZALO_TARGET_USER_ID;
        console.log(`[LISTENER] Target User ID is set to: ${targetUserId}`);

        console.log('[LISTENER] Setting up "message" event listener...');
        api.listener.on('message', (message) => {
            // --- LOG QUAN TRỌNG NHẤT ---
            // Log toàn bộ đối tượng message ngay khi nhận được, TRƯỚC KHI lọc.
            console.log('[MESSAGE RECEIVED] Raw message object:', message);

            const senderId = message.threadId;
            const messageType = message.type;

            console.log(`[FILTERING] Comparing senderId (${senderId}) with targetUserId (${targetUserId}).`);
            console.log(`[FILTERING] Message type is: ${messageType} (Expected: ${ThreadType.User})`);

            if (messageType === ThreadType.User && senderId === targetUserId) {
                console.log('[FILTERING] ✅ SUCCESS: Message matched the filter.');
                const newMessage = {
                    id: message.data.msgId,
                    content: message.data.content,
                    sender: message.data.dName,
                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                };
                globalThis.receivedMessages.unshift(newMessage);
                if (globalThis.receivedMessages.length > 20) {
                    globalThis.receivedMessages.pop();
                }

                console.log(`[EMITTING] Emitting 'new_zalo_message' to clients: "${newMessage.content}"`);
                io.emit('new_zalo_message', newMessage);
            } else {
                console.log('[FILTERING] ❌ REJECTED: Message did not match the filter.');
            }
        });

        console.log('[LISTENER] Starting message listener...');
        api.listener.start();
        console.log("[LISTENER] ✅ SUCCESS: Zalo listener is now running persistently.");

    } catch (error) {
        console.error("❌ ZALO BOT FAILED:", error.message);
        globalThis.zaloApi = null;
        socket.emit('login_error', { message: error.message });
    }
}