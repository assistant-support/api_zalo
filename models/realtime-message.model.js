// /models/realtime-message.model.js
import mongoose from 'mongoose';

const RealtimeMessageSchema = new mongoose.Schema(
    {
        room: { type: String, index: true },      // room logic (vd: "demo", "thread:123" -> bạn nối prefix ở server)
        text: { type: String, required: true },
        meta: { type: mongoose.Schema.Types.Mixed },
        ts: { type: Date, default: Date.now, index: true },
    },
    { versionKey: false, timestamps: false, collection: 'realtime_messages' }
);

export const RealtimeMessage =
    mongoose.models.RealtimeMessage ||
    mongoose.model('RealtimeMessage', RealtimeMessageSchema);
