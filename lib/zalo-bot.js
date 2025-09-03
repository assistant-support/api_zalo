import { Zalo, ThreadType } from "zca-js";
import fs from 'fs';
import path from 'path';

// --- State Management ---
// Sử dụng globalThis để duy trì trạng thái ổn định trong môi trường dev
globalThis.zaloApi = null;
globalThis.conversations = {}; // Key: threadId, Value: [messageObject]
globalThis.userInfoCache = {}; // Key: userId, Value: {name, avatar}
let sessionSaveInterval = null; // Biến quản lý vòng lặp lưu session

const SESSION_FILE_PATH = path.resolve('./zalo-session.json');

// === Helper Functions ===
/** Lấy thông tin người dùng và cache lại */
async function fetchAndCacheUserInfo(userId) {
    if (!globalThis.zaloApi) {
        // Trả về dữ liệu tạm nếu chưa đăng nhập
        return { name: `User ${userId.slice(-4)}` };
    }
    // Trả về từ cache nếu có
    if (globalThis.userInfoCache[userId]) {
        return globalThis.userInfoCache[userId];
    }
    // Gọi API để lấy thông tin mới
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

// --- Core Logic ---
/** Thiết lập các listener và vòng lặp lưu session sau khi đăng nhập thành công */
function setupSessionAndListeners(io, api) {
    globalThis.zaloApi = api;
    console.log("[SESSION] Session is active. Setting up listeners and session saver...");

    // Thiết lập listener tin nhắn
    api.listener.on('message', async (message) => {
        if (message.type !== ThreadType.User) return; // Chỉ xử lý tin nhắn cá nhân

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

    // Thiết lập listener đăng xuất
    api.listener.on('logout', (reason) => {
        console.error(`❌ LOGOUT EVENT: ${reason}`);
        handleLogout(io);
    });

    // Khởi động listener
    api.listener.start();
    console.log("✅ Zalo listener is running.");

    // Bắt đầu vòng lặp tự động lưu session
    if (sessionSaveInterval) clearInterval(sessionSaveInterval);
    sessionSaveInterval = setInterval(() => {
        if (!globalThis.zaloApi) {
            clearInterval(sessionSaveInterval);
            return;
        }
        try {
            // Lấy thông tin xác thực mới nhất từ phiên đang hoạt động
            const sessionData = {
                cookie: globalThis.zaloApi.getCookie(),
                userAgent: globalThis.zaloApi.listener.ctx.userAgent,
                imei: globalThis.zaloApi.listener.ctx.imei,
            };
            fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessionData, null, 2));
            console.log(`[SESSION] ✅ Session state auto-saved.`);
        } catch (error) {
            console.error("❌ Failed to auto-save session state:", error.message);
        }
    }, 300000); // Lưu mỗi 5 phút
}

/** Xử lý đăng nhập bằng QR code */
export async function handleQrLogin(io, socket) {
    if (globalThis.zaloApi) {
        socket.emit('login_status', { isLoggedIn: true });
        return;
    }
    try {
        const zalo = new Zalo();
        const api = await zalo.loginQR((qrCodeBase64) => {
            const qrCodeDataUrl = `data:image/png;base64,${qrCodeBase64}`;
            socket.emit('qr_code_generated', qrCodeDataUrl);
        });

        console.log("✅ QR Login Successful!");
        io.emit('login_status', { isLoggedIn: true });
        setupSessionAndListeners(io, api);
    } catch (error) {
        console.error("❌ QR Login Failed:", error.message);
        socket.emit('login_error', { message: error.message });
    }
}

// --- Main Initialization & Other Functions ---
/** Hàm khởi tạo chính, được gọi MỘT LẦN khi server bắt đầu */
export async function initializeZaloBot(io) {
    if (!fs.existsSync(SESSION_FILE_PATH)) {
        console.log('[INIT] No session file found. Waiting for client to request QR login.');
        return;
    }
    try {
        console.log('[INIT] Found session file. Attempting to login from state...');
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf-8'));

        if (!sessionData.cookie || !sessionData.imei || !sessionData.userAgent) {
            throw new Error("Invalid session file.");
        }

        const zalo = new Zalo();
        const api = await zalo.login(sessionData); // Đăng nhập bằng cookie, imei, userAgent

        console.log("✅ Login from saved session successful!");
        io.emit('login_status', { isLoggedIn: true });
        setupSessionAndListeners(io, api);

    } catch (error) {
        console.error("❌ Login from saved session failed:", error.message, "A new QR login will be required.");
        fs.unlinkSync(SESSION_FILE_PATH); // Xóa file session hỏng
    }
}

/** Đăng xuất thủ công */
export function handleLogout(io) {
    if (sessionSaveInterval) clearInterval(sessionSaveInterval);
    if (fs.existsSync(SESSION_FILE_PATH)) fs.unlinkSync(SESSION_FILE_PATH);
    if (globalThis.zaloApi?.logout) globalThis.zaloApi.logout();

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
    } catch (error) {
        console.error('[Health Check] ❌ Session is dead. Triggering logout.');
        handleLogout(io);
    }
}