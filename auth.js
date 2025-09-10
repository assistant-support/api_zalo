// auth.js
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: 'jwt' },
    trustHost: true,

    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            allowDangerousEmailAccountLinking: true,
            profile(p) {
                return {
                    id: p.sub,
                    name: p.name || p.email?.split('@')[0],
                    email: p.email,
                    image: p.picture,
                };
            },
        }),
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize({ email, password }) {
                if (!email || !password) return null;

                // ⚠️ Dynamic import ở trong hàm → không bị bundle vào middleware (Edge)
                const [{ connectMongo }, { default: User }] = await Promise.all([
                    import('./lib/db_connect.js'),
                    import('./models/account.model.js'),
                ]);

                await connectMongo();
                const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
                if (!user) return null;
                if (user.provider && user.provider !== 'credentials') return null;
                if (user.status && user.status !== 'active') return null;

                const ok = await bcrypt.compare(password, user.password || '');
                if (!ok) return null;

                return {
                    id: String(user._id),
                    name: user.name,
                    email: user.email,
                    image: user.avatar,
                    username: user.username,
                    role: 'sale',
                    provider: 'credentials',
                    status: user.status,
                };
            },
        }),
    ],

    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === 'google') {
                const [{ connectMongo }, { default: User }] = await Promise.all([
                    import('./lib/db_connect.js'),
                    import('./models/account.model.js'),
                ]);
                await connectMongo();

                const email = user.email?.toLowerCase();
                if (!email) return false;

                const existed = await User.findOne({ email });
                if (existed) {
                    existed.name = existed.name || user.name || existed.name;
                    existed.avatar = user.image || existed.avatar;
                    if (!existed.provider || existed.provider === 'credentials') existed.provider = 'google';
                    if (!existed.emailVerified) existed.emailVerified = new Date();
                    await existed.save();
                } else {
                    await User.create({
                        name: user.name || email.split('@')[0],
                        email,
                        username: undefined,
                        password: Math.random().toString(36).slice(2) + Date.now(),
                        avatar: user.image,
                        status: 'active',
                        provider: 'google',
                        emailVerified: new Date(),
                    });
                }
            }
            return true;
        },

        async jwt({ token, user }) {
            if (user) {
                token.uid = user.id;
                token.username = user.username;
                token.role = user.role ?? 'sale';
                token.status = user.status ?? 'active';
                return token;
            }

            // Làm giàu token từ DB khi cần
            try {
                const [{ connectMongo }, { default: User }] = await Promise.all([
                    import('./lib/db_connect.js'),
                    import('./models/account.model.js'),
                ]);
                await connectMongo();
                const u = await User.findOne({ email: token.email }).lean();
                if (u) {
                    token.uid = String(u._id);
                    token.username = u.username;
                    token.status = u.status;
                    // xác định admin bằng role ref; nếu chưa có Role model, mặc định 'user'
                    try {
                        // chỉ populate khi cần
                        const doc = await User.findById(u._id).populate({ path: 'roles', select: 'name isImmutable' });
                        const isAdmin = (doc.roles || []).some((r) => r?.name === 'admin' || r?.isImmutable);
                        token.role = isAdmin ? 'admin' : 'sale';
                    } catch {
                        token.role = token.role || 'sale';
                    }
                }
            } catch {
                token.role = token.role || 'sale';
            }
            return token;
        },

        async session({ session, token }) {
            session.user.id = token.uid;
            session.user.username = token.username;
            session.user.role = token.role || 'sale';
            session.user.status = token.status || 'active';
            return session;
        },
    },

    pages: { signIn: '/login' },
});
