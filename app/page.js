export const runtime = 'nodejs';

import { redirect } from 'next/navigation';
import { getSessionUserLite } from '@/app/actions/session.action';

export default async function Dashboard() {
    const me = await getSessionUserLite();
    if (!me) redirect('/login'); 
    return (
        <main className="p-6 space-y-4">
            <pre className="text-xs bg-gray-50 p-3 rounded">
                {JSON.stringify({ me }, null, 2)}
            </pre>
        </main>
    );
}
