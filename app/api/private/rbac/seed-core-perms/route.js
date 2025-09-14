// /app/api/private/rbac/seed-core-perms/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectMongo } from '@/lib/db_connect';
import Permission from '@/models/permission.model';
import { getIO } from '@/lib/socket';

function emitPermissionEvent(type, doc) {
    getIO()?.to('room:permissions').emit('rt:message', {
        type,
        doc: { ...doc, kind: 'permission' },
    });
}
const normTags = (v) =>
    !v ? [] : Array.isArray(v) ? v.filter(Boolean) : String(v).split(',').map(s => s.trim()).filter(Boolean);

export async function GET() {
    const session = await auth();
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ ok: false, error: 'ONLY_ADMIN' }, { status: 403 });
    }

    await connectMongo();

    const specs = [
        { action: 'role:list', group: 'RBAC', label: 'Xem Roles', description: 'Xem danh sách Role', tags: ['rbac', 'read'] },
        { action: 'permission:list', group: 'RBAC', label: 'Xem Permissions', description: 'Xem danh sách Permission', tags: ['rbac', 'read'] },
        { action: 'role:create', group: 'RBAC', label: 'Tạo Role', description: 'Tạo mới Role', tags: ['rbac', 'write'] },
        { action: 'permission:create', group: 'RBAC', label: 'Tạo Permission', description: 'Tạo mới Permission', tags: ['rbac', 'write'] },
    ];

    const created = [];
    const existed = [];

    for (const s of specs) {
        const found = await Permission.findOne({ action: s.action }).lean();
        if (found) {
            existed.push(s.action);
            continue;
        }
        const doc = await Permission.create({
            action: s.action,
            group: s.group,
            description: s.description,
            label: s.label || s.action,
            tags: normTags(s.tags),
        });
        // realtime cập nhật UI trang Roles ngay
        emitPermissionEvent('insert', {
            _id: doc._id,
            action: doc.action,
            group: doc.group,
            description: doc.description,
            label: doc.label,
            tags: doc.tags,
        });
        created.push(s.action);
    }

    return NextResponse.json({ ok: true, created, existed }, { status: 200 });
}
