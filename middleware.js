// Cách dùng chính thống ở v5: export { auth as middleware } để kích hoạt authorized()
export { auth as middleware } from "@/auth";

/**
 * Chỉ match những route thực sự cần bảo vệ.
 * Lưu ý: KHÔNG đưa /login vào đây (để trang login tự redirect khi đã đăng nhập).
 */

export const config = {
    matcher: [
        "/zalo/:path*", // Bảo vệ trạng zalo và các trang con của zalo (vd: /zalo/12345)
    ],
};