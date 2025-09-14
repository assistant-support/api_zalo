'use server';

/**
 * ======================= GHI CHÚ QUẢN LÝ =======================
 * Mục tiêu file này:
 * - Cấp 1 "chức năng / permission" (theo action) cho 1 Role.
 * - Tự tạo Permission nếu chưa có (idempotent).
 * - Cho phép gắn kèm:
 *    + conditions (ABAC – giới hạn record)
 *    + allowedFields (field-level – giới hạn trường được thao tác)
 * - Phát realtime để UI bảng Role cập nhật tức thì.
 * - Invalidate session của tất cả user thuộc Role → áp quyền ngay.
 *
 * Bảo mật/kiểm quyền:
 * - Bọc bằng withPermAction('role:grant') → chỉ ai có quyền 'role:grant' mới dùng được.
 *
 * Lưu ý tương thích:
 * - Next 15.5.2 / React 19.1.0 / next-auth v5 beta / mongoose 8.18 / socket.io 4.8.1.
 * - Không đổi schema; tái sử dụng patterns trong dự án.
 * ================================================================
 */

import mongoose from 'mongoose';
import { connectMongo } from '@/lib/db_connect';
import { getIO } from '@/lib/socket';
import Role from '@/models/role.model.js';
import Permission from '@/models/permission.model.js';
import { withPermAction } from '@/lib/rbac';

/* ----------------------------------------------------------------
 * Helper: chuẩn hoá/validate input
 * ---------------------------------------------------------------- */
function normalizeAllowedFields(v) {
    // Cho phép truyền '*', hoặc mảng string; fallback ['*']
    if (v === '*') return ['*'];
    if (Array.isArray(v)) return v.filter(Boolean);
    return ['*'];
}
function normalizeTags(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string')
        return v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    return [];
}

/* ----------------------------------------------------------------
 * Helper: tạo Permission nếu chưa có (action duy nhất).
 * - Dùng để nhóm logic "ensure" 1 chỗ, không rải khắp nơi.
 * ---------------------------------------------------------------- */
async function ensurePermission({ action, group, description, label, tags = [] }) {
    let p = await Permission.findOne({ action });
    if (!p) {
        p = await Permission.create({
            action,
            group,
            description,
            label: label || action,
            tags: normalizeTags(tags),
        });
    }
    return p;
}

/* ----------------------------------------------------------------
 * Helper: buildRoleView(roleId)
 * - Trả về "view mở rộng" của Role (expand permission + kèm conditions/allowedFields).
 * - Gửi view này qua realtime để Roles UI cập nhật ngay không cần reload.
 * ---------------------------------------------------------------- */
async function buildRoleView(roleId) {
    const r = await Role.findById(roleId)
        .populate('permissions.permission', 'action label tags group description')
        .lean();

    if (!r) return null;

    return {
        _id: r._id,
        name: r.name,
        description: r.description,
        isImmutable: r.isImmutable,
        createdAt: r.createdAt,
        kind: 'role', // cờ UI đang dùng để phân loại gói tin
        permissionsExpanded: (r.permissions || []).map((b) => ({
            _id: b.permission?._id,
            action: b.permission?.action,
            label: b.permission?.label || b.permission?.action,
            group: b.permission?.group,
            description: b.permission?.description,
            tags: Array.isArray(b.permission?.tags) ? b.permission.tags : [],
            conditions: b.conditions || {},
            allowedFields: Array.isArray(b.allowedFields) ? b.allowedFields : [],
        })),
    };
}

/* ----------------------------------------------------------------
 * Helper: phát realtime + yêu cầu user thuộc role refresh session
 * ---------------------------------------------------------------- */
function emitRoleUpdateView(view) {
    if (!view) return;
    getIO()?.to('room:roles').emit('rt:message', { type: 'update', doc: view });
}

async function invalidateUsersByRole(roleId) {
    // Không import model User để giảm tải – query thẳng collection cho nhẹ.
    const users = await mongoose.connection
        .collection('accounts')
        .find({ role: new mongoose.Types.ObjectId(String(roleId)) }, { projection: { _id: 1 } })
        .toArray();

    users.forEach((u) => {
        getIO()?.to(`room:user:${u._id}`).emit('auth:invalidate', {
            reason: 'role-permissions-updated',
        });
    });
}

/* ----------------------------------------------------------------
 * Action chính: grantPermissionToRole
 * - Bọc withPermAction('role:grant') để enforce quyền.
 * - Quy tắc gộp/cập nhật binding:
 *    + Nếu Role chưa có permission → push {permission, conditions, allowedFields}
 *    + Nếu đã có → cập nhật conditions/allowedFields (không tạo bản sao trùng).
 * ---------------------------------------------------------------- */
export const grantPermissionToRole = withPermAction(
    'role:grant',
    /**
     * @param {{claims:any, allowedFields:string[], conditions:object}} _permit  // (không dùng ở đây, nhưng giữ để signature thống nhất)
     * @param {{
     *   roleId?: string,
     *   roleName?: string,
     *   action: string,
     *   group: string,
     *   description: string,
     *   label?: string,
     *   tags?: string[]|string,
     *   conditions?: object,
     *   allowedFields?: string[]|'*'
     * }} payload
     */
    async (_permit, payload) => {
        await connectMongo();

        // 1) Validate input cơ bản (đủ để xác định/ký nghĩa permission)
        const {
            roleId,
            roleName,
            action,
            group,
            description,
            label,
            tags,
            conditions = {},
            allowedFields = ['*'],
        } = payload || {};

        if (!action || !group || !description) {
            return { ok: false, error: 'Thiếu action/group/description' };
        }
        if (!roleId && !roleName) {
            return { ok: false, error: 'Thiếu roleId hoặc roleName' };
        }

        // 2) Tìm role theo id/name
        const role = roleId
            ? await Role.findById(new mongoose.Types.ObjectId(String(roleId)))
            : await Role.findOne({ name: String(roleName) });

        if (!role) return { ok: false, error: 'Role không tồn tại' };
        if (role.isImmutable) return { ok: false, error: 'Role immutable không thể sửa' };

        // 3) Đảm bảo Permission tồn tại (tự tạo nếu thiếu)
        const perm = await ensurePermission({ action, group, description, label, tags });

        // 4) Ghép/cập nhật binding trong Role (idempotent)
        const af = normalizeAllowedFields(allowedFields);
        const idx = (role.permissions || []).findIndex(
            (p) => String(p.permission) === String(perm._id)
        );

        if (idx === -1) {
            role.permissions.push({ permission: perm._id, conditions: conditions || {}, allowedFields: af });
        } else {
            role.permissions[idx].conditions = conditions || {};
            role.permissions[idx].allowedFields = af;
        }

        await role.save();

        // 5) Phát realtime view mở rộng + invalidate mọi user thuộc role
        const view = await buildRoleView(role._id);
        emitRoleUpdateView(view);
        await invalidateUsersByRole(role._id);

        return { ok: true };
    }
);
