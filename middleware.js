export { auth as middleware } from "@/auth";

// Protect everything except Next.js internals, public assets, the auth endpoints and the /login page itself
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|images|fonts|api/auth|login).*)",
    ],
};
