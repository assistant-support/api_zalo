import { Zalo, ThreadType } from "zca-js";

// === State Management ===
globalThis.zaloApi = null;
globalThis.conversations = {};
globalThis.userInfoCache = {};

// === Helper Functions ===
async function fetchAndCacheUserInfo(userId) {
    // --- LOG ---
    console.log(`[User Info] Attempting to fetch profile for userId: ${userId}`);
    if (!globalThis.zaloApi) {
        console.log('[User Info] Aborted: Not logged in.');
        return { name: `User ${userId.slice(-4)}` };
    }
    if (globalThis.userInfoCache[userId]) {
        console.log('[User Info] ✅ Hit cache. Returning cached data.');
        return globalThis.userInfoCache[userId];
    }
    try {
        console.log(`[User Info] Cache miss. Calling API for userId: ${userId}`);
        const userInfo = await globalThis.zaloApi.getUserProfile({ userId });
        const userData = { name: userInfo.name, avatar: userInfo.avatar };
        globalThis.userInfoCache[userId] = userData;
        console.log(`[User Info] ✅ Success: Cached info for ${userInfo.name}`);
        return userData;
    } catch (error) {
        console.error(`[User Info] ❌ Failed to fetch profile for ${userId}:`, error.message);
        const fallbackData = { name: `User ${userId.slice(-4)}` };
        globalThis.userInfoCache[userId] = fallbackData;
        return fallbackData;
    }
}

// === Core Functions ===
export async function handleQrLogin(io, socket) {
    // --- LOG ---
    console.log(`[QR LOGIN] Process started for client: ${socket.id}`);
    if (globalThis.zaloApi) {
        console.log("[QR LOGIN] Session already active. Sending initial state.");
        socket.emit('login_status', { isLoggedIn: true });
        socket.emit('initial_state', { conversations: globalThis.conversations, userInfo: globalThis.userInfoCache });
        return;
    }
    try {
        const zalo = new Zalo();

        // --- LOG ---
        console.log('[QR LOGIN] Calling zalo.loginQR and waiting for callback...');
        const api = await zalo.loginQR((qrCodeBase64) => {
            console.log('[QR LOGIN] ✅ SUCCESS: QR Callback has been EXECUTED!');
            const qrCodeDataUrl = `data:image/png;base64,${qrCodeBase64}`;
            console.log(`[QR LOGIN] ⬅️ Emitting 'qr_code_generated' to client ${socket.id}.`);
            socket.emit('qr_code_generated', qrCodeDataUrl);
        });


        // --- LOG: Người dùng đã quét mã ---
        console.log("[QR LOGIN] ✅ SUCCESS: User has scanned the QR. Login promise resolved.");
        globalThis.zaloApi = api;
        io.emit('login_status', { isLoggedIn: true });

        // --- LOG: Bắt đầu thiết lập listener ---
        console.log('[LISTENER] Setting up event listeners (message, logout, error)...');
        api.listener.on('message', async (message) => {
            console.log('[LISTENER] 📩 Received a "message" event.');
            if (message.type !== ThreadType.User) {
                console.log('[LISTENER] Message ignored (not a user message).');
                return;
            }
            // ... (phần code xử lý tin nhắn không đổi)
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
            console.log(`[LISTENER] ⬅️ Emitting 'new_message' for thread ${threadId}.`);
            io.emit('new_message', { threadId, message: newMessage, userInfo });
        });

        api.listener.on('logout', (reason) => {
            console.error(`[LISTENER] ❌ LOGOUT EVENT DETECTED. Reason: ${reason}`);
            handleLogout(io);
        });

        api.listener.on('error', (err) => {
            console.error(`[LISTENER] ❌ ERROR EVENT DETECTED:`, err);
            handleLogout(io);
        });

        api.listener.start();
        console.log("[LISTENER] ✅ SUCCESS: Zalo listener is now running persistently.");

    } catch (error) {
        console.error("❌ QR Login Failed:", error.message);
        globalThis.zaloApi = null;
        socket.emit('login_error', { message: error.message });
    }
}

export function handleLogout(io) {
    // --- LOG ---
    console.log('[LOGOUT] handleLogout function called.');
    if (globalThis.zaloApi?.logout) {
        console.log('[LOGOUT] Calling api.logout()...');
        globalThis.zaloApi.logout();
    }
    globalThis.zaloApi = null;
    globalThis.conversations = {};
    globalThis.userInfoCache = {};
    console.log('[LOGOUT] ⬅️ Emitting "login_status: false" to all clients.');
    io.emit('login_status', { isLoggedIn: false, reason: 'Session ended.' });
}

export async function findUserByPhone(phone) {
    // --- LOG ---
    console.log(`[API] findUserByPhone called with phone: ${phone}`);
    if (!globalThis.zaloApi) return { error: 'Not logged in.' };
    try {
        const result = await globalThis.zaloApi.findUser(phone);
        console.log('[API] ✅ findUserByPhone success:', result);
        if (result?.uid) {
            globalThis.userInfoCache[result.uid] = { name: result.zalo_name, avatar: result.avatar };
        }
        return result;
    } catch (error) {
        console.error('[API] ❌ findUserByPhone error:', error.message);
        return { error: error.message };
    }
}

export async function sendMessage(threadId, text) {
    // --- LOG ---
    console.log(`[API] sendMessage called for thread: ${threadId}`);
    if (!globalThis.zaloApi) return { error: 'Not logged in.' };
    try {
        const messageObject = { text };
        const result = await globalThis.zaloApi.sendMessage(messageObject, threadId);
        console.log('[API] ✅ sendMessage success:', result);
        return { success: true, data: result };
    } catch (error) {
        console.error('[API] ❌ sendMessage error:', error.message);
        return { error: error.message };
    }
}

export async function checkSessionStatus(io) {
    // --- LOG ---
    console.log('[Health Check] Running...');
    if (!globalThis.zaloApi) {
        console.log('[Health Check] No active session, skipping.');
        return;
    }
    try {
        await globalThis.zaloApi.getSelfProfile();
        console.log('[Health Check] ✅ Session is active.');
    } catch (error) {
        console.error('[Health Check] ❌ Session is dead. Triggering logout.');
        handleLogout(io);
    }
}