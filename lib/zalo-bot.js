import { Zalo, ThreadType } from "zca-js";

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
/** Xử lý đăng nhập bằng QR code */
export async function handleQrLogin(io, socket) {
    if (globalThis.zaloApi) {
        socket.emit('login_status', { isLoggedIn: true });
        socket.emit('initial_state', { conversations: globalThis.conversations, userInfo: globalThis.userInfoCache });
        return;
    }
    try {
        const zalo = new Zalo();

        const api = await zalo.loginQR((qrCodeBase64) => {
            const qrCodeDataUrl = `data:image/png;base64,${qrCodeBase64}`;
            socket.emit('qr_code_generated', qrCodeDataUrl);
        });

        console.log("✅ QR Login Successful!");
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

        api.listener.on('error', (err) => {
            console.error(`❌ LISTENER ERROR:`, err);
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