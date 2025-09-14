// /auth.js
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// === Helper: build claims (role + permissions) ===
async function buildRoleClaims(userDoc) {
    const [{ default: Role }] = await Promise.all([
        import("./models/role.model.js"),
        import("./models/permission.model.js"), // đảm bảo model 'permission' đã register
    ]);

    if (!userDoc?.role) {
        return { roleId: null, roleName: null, isAdmin: false, perms: [] };
    }

    const role = await Role.findById(userDoc.role)
        .populate({ path: "permissions.permission", select: "action group description label tags" })
        .lean();

    if (!role) return { roleId: null, roleName: null, isAdmin: false, perms: [] };

    const roleName = role.name;
    const isAdmin = roleName === "admin";

    const perms = (role.permissions || [])
        .map((p) => ({
            action: p?.permission?.action || "",
            label: p?.permission?.label || p?.permission?.action || "",
            group: p?.permission?.group || "",
            tags: Array.isArray(p?.permission?.tags) ? p.permission.tags : [],
            conditions: p?.conditions || {},
            allowedFields: Array.isArray(p?.allowedFields) ? p.allowedFields : [],
        }))
        .filter((p) => p.action);

    return { roleId: String(role._id), roleName, isAdmin, perms };
}


export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
    trustHost: true,
    pages: { signIn: "/login" },

    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
            allowDangerousEmailAccountLinking: true,
            profile: (p) => ({ id: p.sub, name: p.name || p.email?.split("@")[0], email: p.email, image: p.picture }),
        }),

        Credentials({
            name: "Credentials",
            credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
            async authorize({ email, password }) {
                if (!email || !password) return null;

                const [{ connectMongo }, { default: User }] = await Promise.all([
                    import("./lib/db_connect.js"),
                    import("./models/account.model.js"),
                ]);
                await connectMongo();

                const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
                if (!user) return null;
                if (user.provider && user.provider !== "credentials") return null; // chỉ credentials mới login bằng mật khẩu
                if (user.status !== "active") return null;

                const ok = await bcrypt.compare(password, user.password || "");
                if (!ok) return null;

                return {
                    id: String(user._id),
                    name: user.name,
                    email: user.email,
                    image: user.avatar,
                    username: user.username,
                };
            },
        }),
    ],

    callbacks: {
        authorized: ({ auth }) => !!auth?.user,

        async signIn({ user, account }) {
            if (account?.provider !== "google") return true;

            const [{ connectMongo }, { default: User }, { default: Role }] = await Promise.all([
                import("./lib/db_connect.js"),
                import("./models/account.model.js"),
                import("./models/role.model.js"),
            ]);
            await connectMongo();

            const email = user.email?.toLowerCase();
            if (!email) return false;

            // Role mặc định = role đầu tiên theo createdAt
            const defaultRole = await Role.findOne({}).sort({ createdAt: 1 }).lean();
            if (!defaultRole) return false; // không có role mặc định -> chặn tạo user

            const existed = await User.findOne({ email });
            if (existed) {
                existed.name = existed.name || user.name || existed.name;
                existed.avatar = user.image || existed.avatar;
                existed.provider = "google";
                existed.emailVerified = existed.emailVerified || new Date();
                if (!existed.role) existed.role = defaultRole._id; // 1 role / user
                await existed.save();
            } else {
                await User.create({
                    name: user.name || email.split("@")[0],
                    email,
                    username: undefined,
                    password: Math.random().toString(36).slice(2) + Date.now(), // hook sẽ hash
                    avatar: user.image,
                    status: "active",
                    provider: "google",
                    emailVerified: new Date(),
                    role: defaultRole._id,
                });
            }
            return true;
        },

        async jwt({ token, user }) {
            const [{ connectMongo }, { default: User }] = await Promise.all([
                import("./lib/db_connect.js"),
                import("./models/account.model.js"),
            ]);
            await connectMongo();

            if (user?.email) {
                const userDoc = await User.findOne({ email: user.email.toLowerCase() }).lean();
                token.uid = String(userDoc?._id);
                token.username = userDoc?.username ?? null;
                token.status = userDoc?.status ?? "active";

                const claims = await buildRoleClaims(userDoc);
                token.roleId = claims.roleId;
                token.roleName = claims.roleName;
                token.isAdmin = claims.isAdmin;
                token.perms = claims.perms;
                return token;
            }

            if (!token.roleId && token.email) {
                const userDoc = await User.findOne({ email: token.email.toLowerCase() }).lean();
                if (userDoc) {
                    token.uid = String(userDoc._id);
                    token.username = userDoc.username ?? null;
                    token.status = userDoc.status ?? "active";

                    const claims = await buildRoleClaims(userDoc);
                    token.roleId = claims.roleId;
                    token.roleName = claims.roleName;
                    token.isAdmin = claims.isAdmin;
                    token.perms = claims.perms;
                }
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.uid;
                session.user.username = token.username ?? null;
                session.user.status = token.status ?? "active";
                session.user.roleId = token.roleId ?? null;
                session.user.roleName = token.roleName ?? null;
                session.user.isAdmin = !!token.isAdmin;
                session.user.perms = Array.isArray(token.perms) ? token.perms : [];
            }
            return session;
        },
    },
});
