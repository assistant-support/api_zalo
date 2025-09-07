export const authConfig = {
    pages: { signIn: '/login' },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const { pathname } = nextUrl;

            // Bảo vệ khu vực riêng
            if (
                pathname.startsWith('/dashboard') ||
                pathname.startsWith('/admin') ||
                pathname.startsWith('/api/private')
            ) {
                return isLoggedIn ? true : false;  // false -> NextAuth tự đẩy về /login
            }

            // Đã login thì không cho vào /login
            if (pathname === '/login' && isLoggedIn) {
                return Response.redirect(new URL('/', nextUrl)); // ✅ theo yêu cầu của bạn
            }

            return true;
        },
    },
};
