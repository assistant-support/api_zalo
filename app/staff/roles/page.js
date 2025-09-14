// /app/admin/roles/page.jsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectMongo } from '@/lib/db_connect';
import Role from '@/models/role.model';
import Permission from '@/models/permission.model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasPerm(session, action) {
    if (session?.user?.isAdmin) return true;
    return (session?.user?.perms || []).some((p) => p.action === action);
}

function NoAccess() {
    return (
        <main className="p-6 h-full flex items-center justify-center">
            <div className="card elev-1 max-w-md w-full p-6 text-center space-y-3 animate-pop">
                <div className="mx-auto h-12 w-12 rounded-full bg-[var(--danger-50)] flex items-center justify-center">
                    {/* lock icon (lucide) bằng emoji cho SSR an toàn nếu chưa import icon */}
                    <span className="text-[var(--danger-700)] text-xl">🔒</span>
                </div>
                <h1 className="text-lg font-semibold">Bạn không có quyền truy cập</h1>
                <p className="text-muted text-sm">
                    Liên hệ quản trị viên để được cấp quyền <code>role:list</code> hoặc <code>admin</code>.
                </p>
            </div>
        </main>
    );
}

import RolesAdmin from './ui/RolesAdmin';

export default async function RolesPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');
    await connectMongo();

    // Nếu không có quyền role:list → render NoAccess
    if (!hasPerm(session, 'role:list')) {
        return <NoAccess />;
    }

    // Tải Roles
    const roles = await Role.find({})
        .populate('permissions.permission', 'action label tags group description')
        .sort({ createdAt: 1 })
        .lean();

    const rolesView = roles.map((r) => ({
        _id: String(r._id),
        name: r.name,
        description: r.description,
        isImmutable: r.isImmutable,
        createdAt: r.createdAt,
        kind: 'role',
        permissionsExpanded: (r.permissions || []).map((b) => ({
            _id: String(b.permission?._id),
            action: b.permission?.action,
            label: b.permission?.label || b.permission?.action,
            group: b.permission?.group,
            description: b.permission?.description,
            tags: Array.isArray(b.permission?.tags) ? b.permission.tags : [],
            conditions: b.conditions || {},
            allowedFields: Array.isArray(b.allowedFields) ? b.allowedFields : [],
        })),
    }));

    // Permission list: chỉ nạp khi có quyền 'permission:list'
    let permissions = [];
    if (hasPerm(session, 'permission:list')) {
        permissions = await Permission.find({})
            .select('action label tags group description createdAt')
            .sort({ group: 1, action: 1 })
            .lean();
    }

    const caps = {
        canGrant: hasPerm(session, 'role:grant'),
        canCreatePerm: hasPerm(session, 'permission:create'),
        canUpdatePerm: hasPerm(session, 'permission:update'),
        canDeletePerm: hasPerm(session, 'permission:delete'),
        canCreateRole: hasPerm(session, 'role:create'),
        canUpdateRole: hasPerm(session, 'role:update'),
        canDeleteRole: hasPerm(session, 'role:delete'),
        canListPerm: hasPerm(session, 'permission:list'),
    };

    return (
        <main className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Quản lý quyền</h1>
            <RolesAdmin
                initialRoles={JSON.parse(JSON.stringify(rolesView))}
                initialPerms={JSON.parse(JSON.stringify(permissions))}
                capabilities={caps}
            />
        </main>
    );
}
