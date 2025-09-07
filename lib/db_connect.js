// lib/db_connect.js
import mongoose from 'mongoose';

const { MONGODB_URI = 'mongodb://127.0.0.1:27017/myapp' } = process.env;

let cached = globalThis.__mongoose_conn;
if (!cached) cached = (globalThis.__mongoose_conn = { conn: null, promise: null });

function attachOnce() {
    if (mongoose.connection && !mongoose.connection.__logged) {
        mongoose.connection.on('connected', () => {
            console.log('[mongo] connected:', mongoose.connection?.name);
        });
        mongoose.connection.on('error', (err) => {
            console.error('[mongo] error:', err);
        });
        mongoose.connection.on('disconnected', () => {
            console.warn('[mongo] disconnected');
        });
        mongoose.connection.__logged = true;
    }
}

export async function connectMongo() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        if (typeof mongoose.set === 'function') mongoose.set('strictQuery', true);
        attachOnce();

        cached.promise = mongoose
            .connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 8000,
                socketTimeoutMS: 45000,
                maxPoolSize: process.env.NODE_ENV === 'production' ? 15 : 5,
                autoIndex: process.env.NODE_ENV !== 'production',
                family: 4,
            })
            .then((m) => m.connection)
            .catch((e) => {
                cached.promise = null;
                throw e;
            });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

export async function disconnectMongo() {
    try {
        if (mongoose.connection?.readyState && mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(false);
            console.log('[mongo] connection closed');
        }
    } catch (e) {
        console.warn('[mongo] disconnect error:', e);
    } finally {
        if (cached) {
            cached.conn = null;
            cached.promise = null;
        }
    }
}
