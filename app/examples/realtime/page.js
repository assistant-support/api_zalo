import mongoose from 'mongoose';
import { connectMongo } from '@/lib/db_connect';
import DemoRealtime from './DemoRealtime';
import { createRealtimeMessage } from './rt-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // tắt cache ở level RSC

async function getInitial(room) {
    await connectMongo();
    const docs = await mongoose.connection
        .collection('realtime_messages')
        .find({ room })
        .sort({ ts: -1 })
        .limit(50)
        .toArray();
    return docs;
}

export default async function Page({ searchParams }) {
    const room = searchParams.room || 'demo';
    let initial = await getInitial(room);
    initial = JSON.parse(JSON.stringify(initial));

    return (
        <main className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Realtime demo — room: {room}</h1>
            <DemoRealtime room={room} createAction={createRealtimeMessage} initial={initial} />
            <p className="text-sm text-neutral-500">
                - Trang SSR lấy snapshot mới nhất từ Mongo, sau đó realtime tiếp qua Socket.IO.<br />
                - Form bên dưới sẽ insert vào Mongo và emit ngay qua socket (không dùng cache).
            </p>
        </main>
    );
}
