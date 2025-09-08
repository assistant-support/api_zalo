// /lib/db_connect.js
import mongoose from 'mongoose';

let cached = global.__mongoose_conn;
if (!cached) cached = global.__mongoose_conn = { conn: null, promise: null };

export async function connectMongo() {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI missing');
        cached.promise = mongoose.connect(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 15000
        }).then((m) => m);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

export async function disconnectMongo() {
    if (cached.conn) {
        await mongoose.disconnect();
        cached.conn = null;
        cached.promise = null;
    }
}
