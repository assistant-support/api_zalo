export const runtime = 'nodejs';

import { auth } from '@/auth';

export async function getSession() {
    const s = await auth();
    return s || null;
}

export async function getSessionUserLite() {
    const s = await auth();
    if (!s?.user) return null;
    const u = s.user;
    console.log(u);
    
    return {
        id: u.id, email: u.email, username: u.username,
        role: u.role, status: u.status, name: u.name, image: u.image,
    };
}

export async function isLoggedIn() {
    const s = await auth();
    return !!s?.user;
}

export async function isAdmin() {
    const s = await auth();
    return s?.user?.role === 'admin';
}
