// /models/proxy.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const ProxySchema = new Schema({
    url: { type: String, required: true },
    label: { type: String, default: null },
    status: { type: String, default: 'unknown' }, // ok|bad|unknown
    latencyMs: { type: Number, default: null },
    lastCheckAt: { type: Date, default: null },
    lastOkAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

ProxySchema.index({ url: 1 }, { unique: true });

export const ProxyModel = mongoose.models.Proxy || mongoose.model('Proxy', ProxySchema);
