'use server';

import mongoose from 'mongoose';
import { connectMongo } from '@/lib/db_connect';
import { getIO } from '@/lib/socket';
import '@/models/realtime-message.model'; // đã tạo ở bước trước

/**
 * Tạo 1 message mới -> insert Mongo -> emit realtime ngay qua Socket.IO
 * Không dùng cache/revalidate, client nhận trực tiếp qua socket.
 */
export async function createRealtimeMessage(formData) {
    const room = String(formData.get('room') || 'demo');
    const text = String(formData.get('text') || '').trim();

    if (!text) {
        return { ok: false, error: 'text is required' };
    }

    await connectMongo();

    // có thể dùng Model hoặc collection thô — dưới đây dùng collection để chắc chắn có _id
    const doc = { room, text, ts: new Date() };
    const result = await mongoose.connection
        .collection('realtime_messages')
        .insertOne(doc);

    doc._id = result.insertedId;

    // Đẩy realtime ngay (không chờ Change Streams)
    getIO()?.to(`room:${room}`).emit('rt:message', { type: 'insert', doc });

    return { ok: true, id: String(result.insertedId) };
}
