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
    api.listener.on('message', async (message) => { /* ... Giữ nguyên như cũ ... */ });
    api.listener.on('logout', (reason) => handleLogout(io));
    api.listener.start();
    console.log("✅ Zalo listener is running.");
    if (sessionSaveInterval) clearInterval(sessionSaveInterval);
    sessionSaveInterval = setInterval(() => { /* ... Giữ nguyên như cũ ... */ }, 300000);
}

/** Xử lý đăng nhập bằng QR code sử dụng fs.watch */
export async function handleQrLogin(io, socket) {
    if (globalThis.zaloApi) {
        socket.emit('login_status', { isLoggedIn: true });
        socket.emit('initial_state', { conversations: globalThis.conversations, userInfo: globalThis.userInfoCache });
        return;
    }
    try {
        const zalo = new Zalo();
        const qrPath = path.resolve('./qr.png');

        if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);

        // Thiết lập "người canh gác" file
        const watcher = fs.watch(process.cwd(), (eventType, filename) => {
            if (filename === 'qr.png') {
                watcher.close(); // Dừng theo dõi ngay khi phát hiện
                let attempts = 0;
                const maxAttempts = 50; // Chờ tối đa 5 giây

                // Bắt đầu vòng lặp kiểm tra file mỗi 0.1 giây
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
                }, 100); // <-- Chờ 0.1 giây (100ms)
            }
        });

        const loginPromise = zalo.loginQR();
        console.log('[ZALO BOT] loginQR() called. Waiting for file watcher and user scan...');

        const api = await loginPromise;
        console.log(api);
        
        watcher.close(); // Đảm bảo watcher đã được đóng lại

        console.log("✅ QR Login Successful!");
        io.emit('login_status', { isLoggedIn: true });
        setupSessionAndListeners(io, api);

    } catch (error) {
        console.error("❌ QR Login Failed:", error.message);
        globalThis.zaloApi = null;
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