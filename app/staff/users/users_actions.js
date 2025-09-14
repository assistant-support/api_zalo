// /app/admin/users/users_actions.js  (đổi tên file để tránh clash path)
'use server';

import mongoose from 'mongoose';
import { connectMongo } from '@/lib/db_connect';
import { getIO } from '@/lib/socket';
import User from '@/models/account.model.js';
import Role from '@/models/role.model.js';
import bcrypt from 'bcryptjs';
import { withPermAction, buildFilter, pickWritable } from '@/lib/rbac';

function emitUsers(type, doc) {
    getIO()?.to('room:users').emit('rt:message', { type, doc });
}
function invalidateUser(uid) {
    getIO()?.to(`room:user:${uid}`).emit('auth:invalidate', { reason: 'role-or-status-updated' });
}

async function assertNotLastAdmin(targetUserId) {
    const adminRole = await Role.findOne({ name: 'admin' }).lean();
    if (!adminRole) return;
    const count = await User.countDocuments({ role: adminRole._id, _id: { $ne: targetUserId } });
    if (count <= 0) throw new Error('Không thể thao tác: đây là admin cuối cùng.');
}

async function getDefaultRole() {
    const r = await Role.findOne({}).sort({ createdAt: 1 }).lean();
    if (!r) throw new Error('Không thể tạo người dùng vì chưa có role mặc định.');
    return r;
}

export const createUser = withPermAction('user:create', async ({ claims, allowedFields, conditions }, formData) => {
    await connectMongo();
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').toLowerCase();
    const password = String(formData.get('password') || '');
    const roleId = String(formData.get('roleId') || '');

    if (!name || !email || !password) return { ok: false, error: 'Thiếu name/email/password' };
    const exists = await User.exists({ email });
    if (exists) return { ok: false, error: 'Email đã tồn tại' };

    const roleDoc = roleId ? await Role.findById(roleId).lean() : await getDefaultRole();
    if (!roleDoc) return { ok: false, error: 'Role không tồn tại' };

    // Field-level: chỉ cho phép một số field khi tạo (tuỳ allowedFields của binding)
    const base = { name, email, status: 'active', provider: 'credentials', role: roleDoc._id };
    const writable = pickWritable(
        { ...base, password: await bcrypt.hash(password, 10) },
        allowedFields
    );

    // Row-level: inject ABAC vào filter tạo (thường tạo không cần filter; tuỳ chính sách)
    // Nếu cần ràng buộc theo group/tenant: verify ở đây (ví dụ writable.group === claims.group)

    const doc = await User.create(writable);

    const view = await mongoose.connection.collection('accounts').aggregate([
        { $match: { _id: doc._id } },
        { $lookup: { from: 'roles', localField: 'role', foreignField: '_id', as: 'role' } },
        { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: 1, username: 1, avatar: 1, provider: 1, status: 1, createdAt: 1, roleName: '$role.name', roleId: '$role._id' } },
    ]).next();

    emitUsers('insert', view);
    return { ok: true, id: String(doc._id) };
});

export const updateUser = withPermAction('user:update', async ({ allowedFields, conditions }, formData) => {
    await connectMongo();
    const id = new mongoose.Types.ObjectId(String(formData.get('id')));
    const status = formData.get('status');
    const roleId = formData.get('roleId');

    const user = await User.findOne({ _id: id, ...conditions }); // ABAC tại đây
    if (!user) return { ok: false, error: 'User không tồn tại hoặc bị hạn chế theo quyền' };

    if (roleId) {
        const curRole = await Role.findById(user.role).lean();
        if (curRole?.name === 'admin' && String(roleId) !== String(curRole._id)) {
            await assertNotLastAdmin(user._id);
        }
    }
    if (status && status !== 'active' && String(user.status) === 'active') {
        const curRole = await Role.findById(user.role).lean();
        if (curRole?.name === 'admin') await assertNotLastAdmin(user._id);
    }

    // Field-level
    const writable = pickWritable(
        {
            ...(status ? { status } : {}),
            ...(roleId ? { role: new mongoose.Types.ObjectId(String(roleId)) } : {}),
        },
        allowedFields
    );
    if (!Object.keys(writable).length) return { ok: false, error: 'Không có trường hợp lệ để cập nhật' };

    await User.updateOne({ _id: id, ...conditions }, { $set: writable });

    const view = await mongoose.connection.collection('accounts').aggregate([
        { $match: { _id: id } },
        { $lookup: { from: 'roles', localField: 'role', foreignField: '_id', as: 'role' } },
        { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: 1, username: 1, avatar: 1, provider: 1, status: 1, createdAt: 1, roleName: '$role.name', roleId: '$role._id' } },
    ]).next();

    emitUsers('update', view);
    invalidateUser(String(id));
    return { ok: true };
});

export const deleteUser = withPermAction('user:delete', async ({ conditions }, id) => {
    await connectMongo();
    const _id = new mongoose.Types.ObjectId(String(id));
    const user = await User.findOne({ _id, ...conditions }).lean();
    if (!user) return { ok: false, error: 'User không tồn tại hoặc bị hạn chế theo quyền' };

    const role = await Role.findById(user.role).lean();
    if (role?.name === 'admin') await assertNotLastAdmin(_id);

    await User.deleteOne({ _id, ...conditions });
    emitUsers('delete', { _id });
    invalidateUser(String(_id));
    return { ok: true };
});
