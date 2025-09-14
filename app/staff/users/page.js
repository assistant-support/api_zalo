/**
 * ======================= GHI CHÚ QUẢN LÝ =======================
 * Mục tiêu trang Users:
 * - Server Component tải dữ liệu Users theo **quyền động** (RBAC + ABAC).
 * - Không hardcode "admin-only". Thay vào đó:
 *   + Ai có 'user:list' sẽ xem được danh sách theo điều kiện ABAC của họ.
 *   + Chỉ ai có 'role:list' mới được tải danh sách Role (để hiển thị trong form).
 *
 * Bảo vệ SSR:
 * - Nếu người dùng không có quyền 'user:list' → redirect về trang chủ.
 * - Tránh format thời gian tại SSR để không gây hydration mismatch.
 *
 * Tương tác realtime:
 * - UI con (UsersAdmin) sẽ join room 'room:users' (đã siết quyền ở socket layer).
 * - Các server actions (create/update/delete) đã bọc withPermAction ở file khác.
 * ================================================================
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectMongo } from '@/lib/db_connect';
import mongoose from 'mongoose';
import { buildFilter } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makeClaimsFromSession(session) {
    const u = session?.user || {};
    return {
        uid: u.id ?? null,
        email: u.email ?? null,
        roleId: u.roleId ?? null,
        roleName: u.roleName ?? null,
        isAdmin: !!u.isAdmin,
        perms: Array.isArray(u.perms) ? u.perms : [],
    };
}
function hasPerm(session, action) {
    if (session?.user?.isAdmin) return true;
    return (session?.user?.perms || []).some((p) => p.action === action);
}

export default async function UsersPage() {
    // 1) Yêu cầu đăng nhập
    const session = await auth();
    if (!session?.user) redirect('/login');

    // 2) Chuẩn bị DB + claims
    await connectMongo();
    const claims = makeClaimsFromSession(session);

    // 3) Dựng filter động theo RBAC/ABAC cho action 'user:list'
    //    - buildFilter() sẽ ném lỗi nếu người dùng không có permission.
    //    - Nếu lỗi → redirect về trang chủ (hoặc trang "không đủ quyền").
    let filter;
    try {
        filter = buildFilter(claims, 'user:list', {}); // có thể chèn extra condition bổ sung ở tham số 3
    } catch {
        redirect('/'); // không đủ quyền xem danh sách
    }

    // 4) Tải danh sách users (đã áp filter ABAC)
    const users = await mongoose.connection
        .collection('accounts') // theo model 'account' => collection name 'accounts'
        .aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'roles',
                    localField: 'role',
                    foreignField: '_id',
                    as: 'role',
                },
            },
            { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: 1,
                    email: 1,
                    username: 1,
                    avatar: 1,
                    provider: 1,
                    status: 1,
                    createdAt: 1, // để UI tự format ở client, tránh toLocaleString SSR
                    roleName: '$role.name',
                    roleId: '$role._id',
                },
            },
            { $sort: { createdAt: -1 } },
        ])
        .toArray();

    // 5) Tải danh sách roles CHỈ khi có quyền 'role:list'
    //    - Nếu không có quyền, trả mảng rỗng; UI vẫn chạy, các thao tác sẽ bị chặn ở Server Action.
    let roles = [];
    if (hasPerm(session, 'role:list')) {
        roles = await mongoose.connection
            .collection('roles')
            .find({}, { projection: { name: 1, description: 1, isImmutable: 1 } })
            .sort({ createdAt: 1 })
            .toArray();
    }

    // 6) Render: để UsersAdmin (client component) xử lý realtime + form
    return (
        <main className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Quản lý nhân sự</h1>
            <UsersAdmin
                initialUsers={JSON.parse(JSON.stringify(users))}
                roles={JSON.parse(JSON.stringify(roles))}
            />
        </main>
    );
}

// Giữ nguyên tách UI để tối ưu bundle và tái sử dụng
import UsersAdmin from './ui/UsersAdmin';
