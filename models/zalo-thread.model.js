// /models/zalo-thread.model.js
// Lưu hội thoại 1-1 theo từng tài khoản: last message, unread,...

import mongoose from 'mongoose';
const { Schema } = mongoose;

const ZaloThreadSchema = new Schema({
    accountId: { type: String, required: true, index: true }, // acc_xxx
    threadId: { type: String, required: true, index: true }, // UID đối tác

    name: { type: String },
    avatar: { type: String },

    lastMessageAt: { type: Date, index: true },
    lastMessageText: { type: String },
    lastMessageType: { type: String }, // text|file|sticker|image|video|voice|other
    lastMessageFrom: { type: String }, // 'in' | 'out'

    unread: { type: Number, default: 0 },
    muted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },

    updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

ZaloThreadSchema.index({ accountId: 1, threadId: 1 }, { unique: true });
ZaloThreadSchema.index({ accountId: 1, lastMessageAt: -1 });
ZaloThreadSchema.index({ accountId: 1, unread: 1 });

export const ZaloThreadModel =
    mongoose.models.ZaloThread || mongoose.model('ZaloThread', ZaloThreadSchema);
