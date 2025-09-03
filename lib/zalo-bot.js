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
        const cookieString = '[{"domain":".zalo.me","expirationDate":1791459385.230373,"hostOnly":false,"httpOnly":false,"name":"__zi","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"3000.SSZzejyD6zOgdh2mtnLQWYQN_RAG01ICFjIXe9fEM8yuaUcacqHUY7EIxA3IH5s5Svhlgpap.1"},{"domain":".zalo.me","expirationDate":1791459385.230512,"hostOnly":false,"httpOnly":false,"name":"__zi-legacy","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"3000.SSZzejyD6zOgdh2mtnLQWYQN_RAG01ICFjIXe9fEM8yuaUcacqHUY7EIxA3IH5s5Svhlgpap.1"},{"domain":".zalo.me","expirationDate":1779709629.469576,"hostOnly":false,"httpOnly":false,"name":"ozi","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"2000.QOBlzDCV2uGerkFzm09Gs6FJuV360bNTBjJdzOy2Lj0ktEJ-EJC.1"},{"domain":".zalo.me","expirationDate":1757360623.562933,"hostOnly":false,"httpOnly":true,"name":"zoaw_sek","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"pVO2.1438426725.2.3WPlQr9b3oytmxDwKcKFBr9b3ozIPGylKnNucZfb3oy"},{"domain":".zalo.me","expirationDate":1757360623.563039,"hostOnly":false,"httpOnly":false,"name":"zoaw_type","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"0"},{"domain":".zalo.me","expirationDate":1756985784.346869,"hostOnly":false,"httpOnly":false,"name":"_zlang","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"vn"},{"domain":".zalo.me","expirationDate":1757072185.326914,"hostOnly":false,"httpOnly":true,"name":"app.event.zalo.me","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"1790618359489358928"},{"domain":".zalo.me","expirationDate":1756975653,"hostOnly":false,"httpOnly":false,"name":"_gid","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GA1.2.723805141.1756827333"},{"domain":".zalo.me","expirationDate":1788363519.989119,"hostOnly":false,"httpOnly":true,"name":"zpsid","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"sZn8.368477220.82.-UO0gU1TlHV4sKi2x5sz5vKkpoJMPOaWrs-F9v5AqUfdJlbOuIEoe8XTlHS"},{"domain":".chat.zalo.me","expirationDate":1758100255.231815,"hostOnly":false,"httpOnly":true,"name":"zpw_sek","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"wjp4.368477220.a0.v8qUAIlWThOFP82Z2k1sjb324zq9sbJQHza6nMBK0CO0fo_Q7BCHzMBN8zjwtKkKLf5XsjPdPV9auGcvd8XsjW"},{"domain":".zalo.me","expirationDate":1791420228.583396,"hostOnly":false,"httpOnly":false,"name":"_ga_1J0YGQPT22","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GS2.1.s1756860228$o2$g0$t1756860228$j60$l0$h0"},{"domain":".zalo.me","expirationDate":1791449253.895363,"hostOnly":false,"httpOnly":false,"name":"_ga","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GA1.1.1736189593.1745149601"},{"domain":".zalo.me","expirationDate":1791449491.864642,"hostOnly":false,"httpOnly":false,"name":"_ga_907M127EPP","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GS2.1.s1756889253$o1$g1$t1756889491$j60$l0$h0"}]';
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