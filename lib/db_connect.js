// /lib/db_connect.js
import mongoose from 'mongoose';

const {
    MONGODB_URI,
    MONGODB_DB,                  // tuỳ chọn: nếu muốn ép db cụ thể (khi URI không có dbName)
    NODE_ENV
} = process.env;

// Dùng globalThis để an toàn trong mọi môi trường Node
let cached = globalThis.__mongoose_conn;
if (!cached) cached = globalThis.__mongoose_conn = { conn: null, promise: null };

// Tuỳ chọn mặc định cho mọi môi trường
const DEFAULT_OPTIONS = {
    maxPoolSize: 10,                    // tuỳ mức concurrency của app
    serverSelectionTimeoutMS: 15000,
    dbName: MONGODB_DB || undefined,    // chỉ set khi có
    // Tối ưu hoá index: bật autoIndex ở dev/test; tắt ở production để tránh cost mỗi lần start
    autoIndex: NODE_ENV !== 'production',
    // (tuỳ chọn) tắt buffering để lỗi rõ ràng nếu dùng model trước khi DB sẵn sàng
    // bufferCommands: false, // <- cái này đặt ở schema hoặc global: mongoose.set('bufferCommands', false)
};

export async function connectMongo(options = {}) {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const uri = options.uri || MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI missing');
        const connectOptions = { ...DEFAULT_OPTIONS, ...options };

        // Gắn listener 1 lần khi bắt đầu
        mongoose.connection.on('connected', () => {
            console.log('[mongo] connected');
        });
        mongoose.connection.on('error', (err) => {
            console.error('[mongo] connection error:', err?.message || err);
        });
        mongoose.connection.on('disconnected', () => {
            console.warn('[mongo] disconnected');
        });

        cached.promise = mongoose.connect(uri, connectOptions).then((m) => m);
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

/**
 * Đồng bộ hoá index cho tất cả model đã load.
 * Gọi 1 lần sau khi import model (ở giai đoạn bootstrap).
 * - production: nên dùng syncIndexes() (an toàn, chỉ tạo/xoá theo schema).
 * - dev: có thể dùng ensureIndexes() hoặc để autoIndex = true.
 */
export async function ensureIndexes({ safe = NODE_ENV === 'production' } = {}) {
    const models = Object.values(mongoose.models);
    if (models.length === 0) return;
    if (safe) {
        await Promise.all(models.map((m) => m.syncIndexes()));
    } else {
        await Promise.all(models.map((m) => m.ensureIndexes()));
    }
}

/** Trạng thái kết nối tiện kiểm tra trong health check */
export function mongoReady() {
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    return mongoose.connection.readyState === 1;
}

/**
 * Chỉ dùng trong test hoặc script CLI.
 * Trong server Socket.IO/Next.js production: KHÔNG gọi hàm này khi đang chạy.
 */
export async function disconnectMongo() {
    if (cached.conn) {
        await mongoose.disconnect();
        cached.conn = null;
        cached.promise = null;
    }
}

/** Helper bọc logic “đảm bảo đã kết nối rồi mới chạy” */
export async function withMongo(fn) {
    await connectMongo();
    return fn(mongoose);
}
