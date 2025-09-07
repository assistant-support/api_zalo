export const runtime = 'nodejs';

import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { getSessionUserLite } from '@/app/actions/session.action';
import { dbPing } from '@/app/actions/db.action';

export default async function Dashboard() {
    const me = await getSessionUserLite();
    if (!me) redirect('/login'); // phòng hờ

    async function logout() {
        'use server';
        await signOut({ redirectTo: '/login' }); // hoặc '/' nếu bạn thích
    }

    const ping = await dbPing();

    return (
        <main className="p-6 space-y-4">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Dashboard</h1>

                {/* Nút Đăng xuất */}
                <form action={logout}>
                    <button
                        type="submit"
                        className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-black transition"
                    >
                        <p className='mb-1'>Đăng xuất</p>
                    </button>
                </form>
            </header>

            <pre className="text-xs bg-gray-50 p-3 rounded">
                {JSON.stringify({ me, ping }, null, 2)}
            </pre>
        </main>
    );
}
