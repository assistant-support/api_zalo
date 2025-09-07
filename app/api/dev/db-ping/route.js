// app/api/dev/db-ping/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db_connect';

export async function GET() {
    await connectMongo();
    return NextResponse.json({ ok: true });
}
