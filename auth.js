// auth.js
// NextAuth v5 – cấu hình gọn, comment dễ đọc.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

/**
 * ENV cần có:
 * - NEXTAUTH_SECRET (hoặc AUTH_SECRET): key mã hoá đó má, không có là không mã hoá được.
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (hoặc AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET): bắt buộc nếu đăng nhập Google.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },        // dùng JWT cho session
    trustHost: true,                      // cho phép host linh hoạt
    pages: { signIn: "/login" },          // trang login tuỳ biến

    // ===== Providers =====
    providers: [
        // Google OAuth
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            allowDangerousEmailAccountLinking: true, // liên kết theo email giữa nhiều provider (cân nhắc bảo mật)
            profile: (p) => ({ id: p.sub, name: p.name || p.email?.split("@")[0], email: p.email, image: p.picture }),
        }),

        // Email/Password
        Credentials({
            name: "Credentials",
            credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
            /**
             * Xác thực credentials:
             * - Lấy user theo email, kiểm tra trạng thái/provider, so sánh bcrypt.
             * - Trả về user "gọn – an toàn" (không trả password), sai thì return null.
             * - Dùng dynamic import để tránh kéo code DB vào môi trường edge.
             */
            async authorize({ email, password }) {
                if (!email || !password) return null;
                const [{ connectMongo }, { default: User }] = await Promise.all([
                    import("./lib/db_connect.js"),
                    import("./models/account.model.js"),
                ]);
                await connectMongo();

                const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
                if (!user) return null;
                if (user.provider && user.provider !== "credentials") return null;
                if (user.status && user.status !== "active") return null;

                const ok = await bcrypt.compare(password, user.password || "");
                if (!ok) return null;

                return {
                    id: String(user._id),
                    name: user.name,
                    email: user.email,
                    image: user.avatar,
                    username: user.username,
                    role: "sale",
                    provider: "credentials",
                    status: user.status,
                };
            },
        }),
    ],

    // ===== Callbacks =====
    callbacks: {
        /**
         * authorized:
         * - Chạy trong middleware (khi export { auth as middleware }).
         * - true => cho qua; false => (với page) tự đẩy về /login; (với API) trả 401.
         * - Với matcher đã chọn vùng private, chỉ cần check “có đăng nhập chưa?”
         */
        authorized: ({ auth }) => !!auth?.user,

        /**
         * signIn:
         * - Nếu login bằng Google: đồng bộ user vào DB (tạo mới hoặc cập nhật avatar/tên, mark emailVerified).
         */
        async signIn({ user, account }) {
            if (account?.provider !== "google") return true;

            const [{ connectMongo }, { default: User }] = await Promise.all([
                import("./lib/db_connect.js"),
                import("./models/account.model.js"),
            ]);
            await connectMongo();

            const email = user.email?.toLowerCase();
            if (!email) return false;

            const existed = await User.findOne({ email });
            if (existed) {
                existed.name = existed.name || user.name || existed.name;
                existed.avatar = user.image || existed.avatar;
                if (!existed.provider || existed.provider === "credentials") existed.provider = "google";
                if (!existed.emailVerified) existed.emailVerified = new Date();
                await existed.save();
            } else {
                await User.create({
                    name: user.name || email.split("@")[0],
                    email,
                    username: undefined,
                    password: Math.random().toString(36).slice(2) + Date.now(),
                    avatar: user.image,
                    status: "active",
                    provider: "google",
                    emailVerified: new Date(),
                });
            }
            return true;
        },

        /**
         * jwt:
         * - Lần đầu có "user": nhúng uid/role/status/username vào token.
         * - Các lần sau: (tuỳ nhu cầu) làm giàu token từ DB để đồng bộ role/status/username.
         */
        async jwt({ token, user }) {
            if (user) {
                token.uid = user.id;
                token.username = user.username;
                token.role = user.role ?? "sale";
                token.status = user.status ?? "active";
                return token;
            }

            try {
                const email = token.email?.toLowerCase?.();
                if (!email) return token;

                const [{ connectMongo }, { default: User }] = await Promise.all([
                    import("./lib/db_connect.js"),
                    import("./models/account.model.js"),
                ]);
                await connectMongo();

                const u = await User.findOne({ email }).lean();
                if (u) {
                    token.uid = String(u._id);
                    token.username = u.username;
                    token.status = u.status;
                    try {
                        const doc = await User.findById(u._id).populate({ path: "roles", select: "name isImmutable" });
                        const isAdmin = (doc.roles || []).some((r) => r?.name === "admin" || r?.isImmutable);
                        token.role = isAdmin ? "admin" : (token.role || "sale");
                    } catch {
                        token.role = token.role || "sale";
                    }
                }
            } catch {
                token.role = token.role || "sale";
            }
            return token;
        },

        /**
         * session:
         * - Quyết định dữ liệu trả về client (đổ từ token vào session.user).
         */
        async session({ session, token }) {
            session.user.id = token.uid;
            session.user.username = token.username;
            session.user.role = token.role || "sale";
            session.user.status = token.status || "active";
            return session;
        },
    },
});
