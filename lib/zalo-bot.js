import { Zalo, ThreadType } from "zca-js";
import fs from 'fs';
import path from 'path';

// === State Management ===
// Sử dụng globalThis để duy trì trạng thái ổn định trong môi trường dev
globalThis.zaloApi = null;
globalThis.conversations = {}; // Key: threadId, Value: [messageObject]
globalThis.userInfoCache = {}; // Key: userId, Value: {name, avatar}

// === Helper Functions ===
/** Lấy thông tin người dùng và cache lại */
async function fetchAndCacheUserInfo(userId) {
    if (!globalThis.zaloApi || globalThis.userInfoCache[userId]) {
        return globalThis.userInfoCache[userId];
    }
    try {
        const userInfo = await globalThis.zaloApi.getUserProfile({ userId });
        const userData = { name: userInfo.name, avatar: userInfo.avatar };
        globalThis.userInfoCache[userId] = userData;
        return userData;
    } catch (error) {
        console.error(`[User Info] Failed to fetch profile for ${userId}:`, error.message);
        const fallbackData = { name: `User ${userId.slice(-4)}` };
        globalThis.userInfoCache[userId] = fallbackData; // Lưu tạm để tránh gọi lại liên tục
        return fallbackData;
    }
}

// === Core Functions ===
/** Xử lý đăng nhập bằng QR code sử dụng fs.watch */
export async function handleQrLogin(io, socket) {
    if (globalThis.zaloApi) {
        console.log("[ZALO BOT] A login session already exists.");
        socket.emit('login_status', { isLoggedIn: true });
        socket.emit('initial_state', { conversations: globalThis.conversations, userInfo: globalThis.userInfoCache });
        return;
    }
    try {
        const zalo = new Zalo();
        const qrPath = path.resolve('./qr.png');

        // Xóa file qr.png cũ nếu có để đảm bảo gửi đúng QR mới
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath);
        }

        // Thiết lập "người canh gác" file
        const watcher = fs.watch(process.cwd(), (eventType, filename) => {
            if (filename === 'qr.png') {
                watcher.close(); // Dừng theo dõi ngay khi phát hiện
                let attempts = 0;
                const maxAttempts = 50; // Chờ tối đa 5 giây
                const checkInterval = setInterval(() => {
                    try {
                        const stats = fs.statSync(qrPath);
                        if (stats.size > 0) {
                            clearInterval(checkInterval);
                            const base64 = fs.readFileSync(qrPath, { encoding: 'base64' });
                            const qrCodeDataUrl = `data:image/png;base64,${base64}`;
                            socket.emit('qr_code_generated', qrCodeDataUrl);
                        } else if (++attempts > maxAttempts) {
                            clearInterval(checkInterval);
                            console.error('[QR STAGE] ❌ ERROR: QR file was created but remained empty.');
                        }
                    } catch (err) { /* Bỏ qua lỗi và thử lại */ }
                }, 100);
            }
        });

        // Bắt đầu quá trình đăng nhập. 
        // Lệnh này sẽ chạy nền và tạo ra file qr.png, kích hoạt watcher ở trên.
        const loginPromise = zalo.loginQR();
        console.log('[ZALO BOT] loginQR() called. Waiting for file watcher and user scan...');

        // Chờ cho đến khi người dùng quét mã xong
        const api = await loginPromise;
        watcher.close(); // Đảm bảo watcher đã được đóng lại
        
        console.log('[ZALO BOT] ✅ SUCCESS: User has scanned the QR. Login complete.');
        globalThis.zaloApi = api;
        io.emit('login_status', { isLoggedIn: true });
        
        api.listener.on('message', async (message) => {
            if (message.type !== ThreadType.User) return;

            const threadId = message.threadId;
            const userInfo = await fetchAndCacheUserInfo(threadId);

            let displayContent = '[Tin nhắn đa phương tiện]';
            if (typeof message.data.content === 'string') {
                displayContent = message.data.content;
            } else if (message.data.msgType === 'chat.sticker') {
                displayContent = '[Sticker]';
            }

            const newMessage = {
                id: message.data.msgId,
                content: displayContent,
                sender: userInfo.name,
                isSelf: message.isSelf,
                timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            };
            
            if (!globalThis.conversations[threadId]) {
                globalThis.conversations[threadId] = [];
            }
            globalThis.conversations[threadId].unshift(newMessage);
            io.emit('new_message', { threadId, message: newMessage, userInfo });
        });

        api.listener.on('logout', (reason) => {
            console.error(`❌ LOGOUT EVENT: ${reason}`);
            handleLogout(io);
        });

        api.listener.start();
        console.log("✅ Zalo listener is running.");

    } catch (error) {
        console.error("❌ QR Login Failed:", error.message);
        globalThis.zaloApi = null;
        socket.emit('login_error', { message: error.message });
    }
}

/** Đăng xuất thủ công */
export function handleLogout(io) {
    if (globalThis.zaloApi?.logout) {
        globalThis.zaloApi.logout();
    }
    globalThis.zaloApi = null;
    globalThis.conversations = {};
    globalThis.userInfoCache = {};
    console.log('User logged out.');
    io.emit('login_status', { isLoggedIn: false, reason: 'Session ended.' });
}

/** Tìm người dùng bằng SĐT */
export async function findUserByPhone(phone) {
    if (!globalThis.zaloApi) return { error: 'Not logged in.' };
    try {
        const result = await globalThis.zaloApi.findUser(phone);
        if (result?.uid) {
            globalThis.userInfoCache[result.uid] = { name: result.zalo_name, avatar: result.avatar };
        }
        return result;
    } catch (error) {
        return { error: error.message };
    }
}

/** Gửi tin nhắn */
export async function sendMessage(threadId, text) {
    if (!globalThis.zaloApi) return { error: 'Not logged in.' };
    try {
        const messageObject = { text };
        const result = await globalThis.zaloApi.sendMessage(messageObject, threadId);
        return { success: true, data: result };
    } catch (error) {
        return { error: error.message };
    }
}

/** Kiểm tra sức khỏe phiên đăng nhập */
export async function checkSessionStatus(io) {
    if (!globalThis.zaloApi) return;

    try {
        await globalThis.zaloApi.getSelfProfile();
        console.log('[Health Check] Session is active.');
    } catch (error) {
        console.error('[Health Check] ❌ Session is dead. Triggering logout.');
        handleLogout(io);
    }
}