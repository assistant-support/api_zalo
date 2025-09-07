import { connectMongo } from './db_connect.js';   // ✅ đúng file
import User from '@/models/account.model.js';
import '@/models/role.model.js';
import '@/models/permission.model.js';

function get(obj, path) {
    return path.split('.').reduce((a, k) => (a?.[k] ?? undefined), obj);
}
function compileTemplate(input, ctx) {
    if (Array.isArray(input)) return input.map((v) => compileTemplate(v, ctx));
    if (input && typeof input === 'object') {
        const out = {};
        for (const k of Object.keys(input)) out[k] = compileTemplate(input[k], ctx);
        return out;
    }
    if (typeof input === 'string') {
        return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
            const val = get(ctx, key.trim());
            return val !== undefined ? String(val) : '';
        });
    }
    return input;
}

function isAdminFromRoles(roles) {
    return Array.isArray(roles) && roles.some((r) => r?.name === 'admin' || r?.isImmutable === true);
}

export async function loadUserAuthz(userId) {
    await connectMongo();
    const u = await User.findById(userId)
        .populate({
            path: 'roles',
            model: 'role',
            populate: {
                path: 'permissions.permission',
                model: 'permission',
                select: 'action group description',
            },
        })
        .lean();

    if (!u) return { isAdmin: false, entries: [] };

    const isAdmin = isAdminFromRoles(u.roles);
    const entries = [];
    for (const role of u.roles || []) {
        for (const rp of role.permissions || []) {
            const p = rp?.permission;
            if (!p) continue;
            entries.push({
                action: p.action,            // ví dụ: 'user.update'
                group: p.group,
                conditions: rp.conditions || {},
                allowedFields: rp.allowedFields?.length ? rp.allowedFields : [],
            });
        }
    }
    return { isAdmin, entries };
}

/** Đánh giá permission cho 1 action, trả về: granted, filter (row-level), allowedFields */
export function evaluateAction(action, authz, currentUserCtx) {
    if (authz?.isAdmin) return { granted: true, filter: {}, allowedFields: ['*'] };

    const matched = (authz?.entries || []).filter((e) => e.action === action);
    if (!matched.length) return { granted: false };

    const ors = [];
    let fields = new Set();
    let wildcard = false;

    for (const e of matched) {
        const cond = compileTemplate(e.conditions || {}, { currentUser: currentUserCtx });
        const isEmpty = !cond || (typeof cond === 'object' && Object.keys(cond).length === 0);
        if (isEmpty) {
            // full dataset access -> không cần OR thêm
            ors.length = 0;
            ors.push({});
            wildcard = wildcard || e.allowedFields?.includes('*');
            if (!wildcard) e.allowedFields?.forEach((f) => fields.add(f));
            break;
        } else {
            ors.push(cond);
            if (e.allowedFields?.includes('*')) wildcard = true;
            else e.allowedFields?.forEach((f) => fields.add(f));
        }
    }

    const filter =
        ors.some((o) => Object.keys(o).length === 0)
            ? {}
            : ors.length === 1
                ? ors[0]
                : { $or: ors };

    return { granted: true, filter, allowedFields: wildcard ? ['*'] : Array.from(fields) };
}

/** Kết hợp filter cơ bản với filter row-level */
export function applyRowLevel(base, rule) {
    if (!rule?.granted) return null;
    if (!rule.filter || Object.keys(rule.filter).length === 0) return base || {};
    if (!base || Object.keys(base).length === 0) return rule.filter;
    return { $and: [base, rule.filter] };
}

/** Giữ lại các field được phép cập nhật */
export function filterUpdatePayload(payload, allowedFields) {
    if (!allowedFields || allowedFields.includes('*')) return payload;
    const out = {};
    for (const k of allowedFields) if (payload[k] !== undefined) out[k] = payload[k];
    return out;
}
