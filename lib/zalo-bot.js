import { Zalo, ThreadType } from "zca-js";

// Khởi tạo các biến toàn cục để lưu trữ trạng thái, giúp chúng không bị reset
// khi code thay đổi trong môi trường development (HMR).
globalThis.zaloApi = null;
globalThis.receivedMessages = [];

/**
 * Hàm này khởi tạo Zalo Bot một lần duy nhất.
 * Nó đăng nhập bằng cookie, sau đó bắt đầu lắng nghe tin nhắn
 * và đẩy tin nhắn mới đến các client thông qua Socket.IO.
 * @param {import('socket.io').Server} io - Instance của Socket.IO server.
 */
export async function initializeZaloBot(io) {
    // Nếu bot đã chạy rồi thì không khởi tạo lại
    if (globalThis.zaloApi) {
        console.log("Zalo bot has already been initialized.");
        return;
    }

    try {
        console.log("Initializing Zalo Bot...");
        // 1. Đọc tất cả thông tin cần thiết từ file .env.local
        const cookieString = process.env.ZALO_COOKIE;
        const imei = process.env.ZALO_IMEI;
        const userAgent = process.env.ZALO_USER_AGENT;
        const targetUserId = process.env.ZALO_TARGET_USER_ID;

        // Kiểm tra để đảm bảo tất cả các biến đều tồn tại
        if (!cookieString || !imei || !userAgent || !targetUserId) {
            throw new Error("Missing Zalo credentials in .env.local file. Please check all 4 variables.");
        }

        // 2. Chuẩn bị dữ liệu và đăng nhập
        const cookie = JSON.parse(cookieString);
        const zalo = new Zalo();
        const api = await zalo.login({ cookie, imei, userAgent });

        // 3. Lưu lại phiên đăng nhập vào biến toàn cục
        globalThis.zaloApi = api;
        console.log("✅ ZALO BOT INITIALIZED SUCCESSFULLY.");

        // 4. Bắt đầu lắng nghe tin nhắn
        api.listener.on('message', (message) => {
            const senderId = message.threadId;

            // Chỉ xử lý tin nhắn cá nhân từ người dùng mục tiêu
            if (message.type === ThreadType.User && senderId === targetUserId) {
                const newMessage = {
                    id: message.data.msgId,
                    content: message.data.content,
                    sender: message.data.dName,
                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                };

                // Lưu tin nhắn vào lịch sử (để người dùng mới vào vẫn thấy)
                globalThis.receivedMessages.unshift(newMessage);
                if (globalThis.receivedMessages.length > 20) {
                    globalThis.receivedMessages.pop();
                }

                // Đẩy tin nhắn mới đến tất cả các client đang kết nối
                console.log(`Emitting 'new_zalo_message' to clients: "${newMessage.content}"`);
                io.emit('new_zalo_message', newMessage);
            }
        });

        api.listener.start();
        console.log("Zalo listener is now running persistently.");

    } catch (error) {
        // Ghi lại lỗi nếu quá trình khởi tạo thất bại
        console.error("❌ FAILED TO INITIALIZE ZALO BOT:", error.message);
        globalThis.zaloApi = null; // Đặt lại trạng thái
    }
}