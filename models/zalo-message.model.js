// /models/zalo-message.model.js
// Lưu từng tin nhắn 1-1: hỗ trợ attachments + link Drive.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const AttachmentSchema = new Schema({
    name: String,
    mime: String,
    size: Number,
    url: String,   // URL có sẵn từ Zalo (nếu có)
    path: String,   // đường dẫn tạm trên server khi gửi từ máy
    type: String,   // image|file|video|voice|sticker|other
    // Google Drive
    driveId: String,
    viewLink: String,       // webViewLink
    downloadLink: String,   // webContentLink
    thumbnailLink: String,  // thumbnailLink (nếu có)
}, { _id: false });

const ZaloMessageSchema = new Schema({
    accountId: { type: String, required: true, index: true },
    threadId: { type: String, required: true, index: true },

    // id từ Zalo
    msgId: { type: String, index: true },
    cliMsgId: { type: String, index: true },

    direction: { type: String, enum: ['in', 'out'], required: true },
    isSelf: { type: Boolean, default: false },

    contentType: { type: String, default: 'text' },
    text: { type: String },
    attachments: { type: [AttachmentSchema], default: [] },

    ts: { type: Date, required: true, index: true },
    raw: { type: Schema.Types.Mixed },
    status: { type: String, default: 'delivered' }, // delivered|seen|sending|uploading|failed

    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

ZaloMessageSchema.index({ accountId: 1, threadId: 1, ts: 1 });
ZaloMessageSchema.index({ accountId: 1, msgId: 1 }, { sparse: true, unique: false });

export const ZaloMessageModel =
    mongoose.models.ZaloMessage || mongoose.model('ZaloMessage', ZaloMessageSchema);
