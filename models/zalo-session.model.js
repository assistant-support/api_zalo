// /models/zalo-session.model.js
// Lưu phiên đăng nhập + thông tin hiển thị + proxy cho mỗi account.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const ZaloSessionSchema = new Schema({
    id: { type: String, required: true, unique: true }, // accountId nội bộ: acc_xxx
    cookie: { type: Schema.Types.Mixed },
    imei: { type: String },
    userAgent: { type: String },

    // Info UI
    displayName: { type: String },
    avatar: { type: String },
    uid: { type: String },   // userId Zalo
    phone: { type: String },   // phoneNumber

    // Proxy
    proxy: { type: String },

    lastLoginAt: { type: Date },
    updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

ZaloSessionSchema.index({ id: 1 }, { unique: true });

export const ZaloAccountModel =
    mongoose.models.ZaloAccount || mongoose.model('ZaloAccount', ZaloSessionSchema);
