// /app/admin/roles/roles_actions.js
"use server";

import mongoose from 'mongoose';
import { connectMongo } from '@/lib/db_connect';
import { getIO } from '@/lib/socket';
import Role from '@/models/role.model.js';
import Permission from '@/models/permission.model.js';
import User from '@/models/account.model.js';
import { withPermAction } from '@/lib/rbac';

/* ===== Helpers ===== */
function parseJsonOr(v, fb) {
    if (!v || typeof v !== 'string') return fb;
    try { return JSON.parse(v); } catch { return fb; }
}

function normAllowedFields(v) {
    if (v === '*') return ['*'];
    if (Array.isArray(v)) return v.filter(Boolean);
    return ['*'];
}

function normTags(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

async function ensurePermission({ action, group, description, label, tags = [] }) {
    let p = await Permission.findOne({ action });
    if (!p) {
        p = await Permission.create({
            action,
            group,
            description,
            label: label || action,
            tags: normTags(tags),
        });
        emitPermissionEvent('insert', {
            _id: p._id, action: p.action, group: p.group,
            description: p.description, label: p.label, tags: p.tags, kind: 'permission',
        });
    }
    return p;
}

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
        kind: 'role',
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

function emitRoleUpdateView(view) {
    if (!view) return;
    getIO()?.to('room:roles').emit('rt:message', { type: 'update', doc: view });
}

function emitRoleDelete(roleId) {
    getIO()?.to('room:roles').emit('rt:message', { type: 'delete', doc: { _id: roleId, kind: 'role' } });
}

function emitPermissionEvent(type, doc) {
    getIO()?.to('room:permissions').emit('rt:message', { type, doc: { ...doc, kind: 'permission' } });
}

async function invalidateUsersByRole(roleId) {
    const ids = await User.find({ role: roleId }).select('_id').lean();
    ids.forEach((u) => {
        getIO()?.to(`room:user:${u._id}`).emit('auth:invalidate', { reason: 'role-updated' });
    });
}

/* ===== Permission CRUD ===== */
export const createPermission = withPermAction('permission:create', async (_permit, formData) => {
    await connectMongo();
    const action = String(formData.get('action') || '').trim();
    const group = String(formData.get('group') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const label = String(formData.get('label') || '').trim();
    const tagsStr = String(formData.get('tags') || '').trim();
    const tags = normTags(tagsStr);
    if (!action || !group || !description) return { ok: false, error: 'Thiếu action/group/description' };
    const existed = await Permission.findOne({ action }).lean();
    if (existed) return { ok: false, error: 'action đã tồn tại' };
    const doc = await Permission.create({ action, group, description, label: label || action, tags });
    emitPermissionEvent('insert', { _id: doc._id, action: doc.action, group: doc.group, description: doc.description, label: doc.label, tags: doc.tags });
    return { ok: true, id: String(doc._id) };
});

export const updatePermission = withPermAction('permission:update', async (_permit, formData) => {
    await connectMongo();
    const id = new mongoose.Types.ObjectId(String(formData.get('id')));
    const group = formData.get('group');
    const description = formData.get('description');
    const label = formData.get('label');
    const tagsStr = formData.get('tags');
    const p = await Permission.findById(id);
    if (!p) return { ok: false, error: 'Permission không tồn tại' };
    if (typeof group === 'string' && group.trim()) p.group = group.trim();
    if (typeof description === 'string' && description.trim()) p.description = description.trim();
    if (typeof label === 'string') p.label = label.trim();
    if (typeof tagsStr === 'string') p.tags = normTags(tagsStr);
    await p.save();
    emitPermissionEvent('update', { _id: p._id, action: p.action, group: p.group, description: p.description, label: p.label, tags: p.tags });
    return { ok: true };
});

export const deletePermission = withPermAction('permission:delete', async (_permit, id) => {
    await connectMongo();
    const _id = new mongoose.Types.ObjectId(String(id));
    const used = await Role.findOne({ 'permissions.permission': _id }).lean();
    if (used) return { ok: false, error: 'Permission đang được role sử dụng' };
    await Permission.deleteOne({ _id });
    emitPermissionEvent('delete', { _id });
    return { ok: true };
});

/* ===== Role CRUD ===== */
export const createRole = withPermAction('role:create', async (_permit, formData) => {
    await connectMongo();
    const name = String(formData.get('name') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const isImmutable = !!formData.get('isImmutable');
    if (!name) return { ok: false, error: 'Thiếu name' };
    const existed = await Role.findOne({ name }).lean();
    if (existed) return { ok: false, error: 'Role đã tồn tại' };
    const doc = await Role.create({ name, description, isImmutable, permissions: [] });
    const view = await buildRoleView(doc._id);
    emitRoleUpdateView(view);
    return { ok: true, id: String(doc._id) };
});

export const updateRoleMeta = withPermAction('role:update', async (_permit, formData) => {
    await connectMongo();
    const id = new mongoose.Types.ObjectId(String(formData.get('id')));
    const name = formData.get('name');
    const description = formData.get('description');
    const role = await Role.findById(id);
    if (!role) return { ok: false, error: 'Role không tồn tại' };
    if (role.isImmutable) return { ok: false, error: 'Role immutable không thể sửa' };
    if (typeof name === 'string' && name.trim()) role.name = name.trim();
    if (typeof description === 'string') role.description = description.trim();
    await role.save();
    const view = await buildRoleView(role._id);
    emitRoleUpdateView(view);
    await invalidateUsersByRole(role._id);
    return { ok: true };
});

export const deleteRole = withPermAction('role:delete', async (_permit, id) => {
    await connectMongo();
    const _id = new mongoose.Types.ObjectId(String(id));
    const role = await Role.findById(_id).lean();
    if (!role) return { ok: false, error: 'Role không tồn tại' };
    if (role.isImmutable) return { ok: false, error: 'Không thể xoá role immutable' };
    const inUse = await User.exists({ role: _id });
    if (inUse) return { ok: false, error: 'Có người dùng đang dùng role này' };
    await Role.deleteOne({ _id });
    emitRoleDelete(_id);
    return { ok: true };
});

/* ===== Bindings (Role <-> Permission) ===== */

// 1 bước: đảm bảo permission + gán/cập nhật binding
export const grantPermissionToRole = withPermAction(
    'role:grant',
    async (_permit, payload) => {
        await connectMongo();
        const {
            roleId, roleName,
            action, group, description, label, tags,
            conditions = {}, allowedFields = ['*'],
        } = payload || {};

        if (!action || !group || !description) return { ok: false, error: 'Thiếu action/group/description' };
        if (!roleId && !roleName) return { ok: false, error: 'Thiếu roleId hoặc roleName' };

        const role = roleId
            ? await Role.findById(new mongoose.Types.ObjectId(String(roleId)))
            : await Role.findOne({ name: String(roleName) });
        if (!role) return { ok: false, error: 'Role không tồn tại' };
        if (role.isImmutable) return { ok: false, error: 'Role immutable không thể sửa' };

        const perm = await ensurePermission({ action, group, description, label, tags });

        const af = normAllowedFields(allowedFields);
        const idx = (role.permissions || []).findIndex(
            (p) => String(p.permission) === String(perm._id)
        );
        if (idx === -1) {
            role.permissions.push({ permission: perm._id, conditions, allowedFields: af });
        } else {
            role.permissions[idx].conditions = conditions || {};
            role.permissions[idx].allowedFields = af;
        }
        await role.save();

        const view = await buildRoleView(role._id);
        emitRoleUpdateView(view);
        await invalidateUsersByRole(role._id);
        return { ok: true };
    }
);

export const attachPermission = withPermAction('role:grant', async (_permit, formData) => {
    await connectMongo();
    const roleId = new mongoose.Types.ObjectId(String(formData.get('roleId')));
    const permissionId = new mongoose.Types.ObjectId(String(formData.get('permissionId')));
    const conditions = parseJsonOr(String(formData.get('conditions') || ''), {});
    let allowedFields = parseJsonOr(String(formData.get('allowedFields') || ''), ['*']);
    allowedFields = normAllowedFields(allowedFields);

    const role = await Role.findById(roleId);
    if (!role) return { ok: false, error: 'Role không tồn tại' };
    if (role.isImmutable) return { ok: false, error: 'Role immutable không thể sửa' };

    const perm = await Permission.findById(permissionId).select('_id').lean();
    if (!perm) return { ok: false, error: 'Permission không tồn tại' };

    const idx = (role.permissions || []).findIndex((b) => String(b.permission) === String(permissionId));
    if (idx === -1) role.permissions.push({ permission: permissionId, conditions, allowedFields });
    else {
        role.permissions[idx].conditions = conditions;
        role.permissions[idx].allowedFields = allowedFields;
    }

    await role.save();
    const view = await buildRoleView(roleId);
    emitRoleUpdateView(view);
    await invalidateUsersByRole(roleId);
    return { ok: true };
});

export const attachPermissionsBulk = withPermAction('role:grant', async (_permit, roleId, permissionIds, options = {}) => {
    await connectMongo();
    const _rid = new mongoose.Types.ObjectId(String(roleId));
    const role = await Role.findById(_rid);
    if (!role) return { ok: false, error: 'Role không tồn tại' };
    if (role.isImmutable) return { ok: false, error: 'Role immutable không thể sửa' };

    const ids = (permissionIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));
    const exists = await Permission.find({ _id: { $in: ids } }).select('_id').lean();
    const existsSet = new Set(exists.map((p) => String(p._id)));

    const conditions = options.conditions ?? {};
    const allowedFields = Array.isArray(options.allowedFields) ? options.allowedFields : ['*'];
    const current = role.permissions || [];
    const currentSet = new Set(current.map((b) => String(b.permission)));

    ids.forEach((pid) => {
        const sid = String(pid);
        if (!existsSet.has(sid)) return;
        if (currentSet.has(sid)) return;
        current.push({ permission: pid, conditions, allowedFields });
    });

    role.permissions = current;
    await role.save();
    const view = await buildRoleView(_rid);
    emitRoleUpdateView(view);
    await invalidateUsersByRole(_rid);
    return { ok: true };
});

export const detachPermission = withPermAction('role:grant', async (_permit, roleId, permissionId) => {
    await connectMongo();
    const _rid = new mongoose.Types.ObjectId(String(roleId));
    const _pid = new mongoose.Types.ObjectId(String(permissionId));
    const role = await Role.findById(_rid);
    if (!role) return { ok: false, error: 'Role không tồn tại' };
    if (role.isImmutable) return { ok: false, error: 'Role immutable không thể sửa' };
    role.permissions = (role.permissions || []).filter((b) => String(b.permission) !== String(_pid));
    await role.save();
    const view = await buildRoleView(_rid);
    emitRoleUpdateView(view);
    await invalidateUsersByRole(_rid);
    return { ok: true };
});
