// /lib/rbac.js
import { auth } from '@/auth';

/** Lấy claims nhẹ từ session (không đụng DB). */
export async function getClaims() {
    const s = await auth();
    const u = s?.user;
    return {
        uid: u?.id ?? null,
        email: u?.email ?? null,
        roleId: u?.roleId ?? null,
        roleName: u?.roleName ?? null,
        isAdmin: !!u?.isAdmin,
        perms: Array.isArray(u?.perms) ? u.perms : [],
    };
}

/** Thay thế biến {{currentUser.xxx}} đệ quy trong object conditions. */
function substitute(input, ctx) {
    if (typeof input === 'string') {
        return input.replace(/\{\{\s*(currentUser(?:\.[\w]+)*)\s*\}\}/g, (_, path) => {
            const keys = path.split('.');
            let cur = { currentUser: ctx };
            for (const k of keys) cur = cur?.[k];
            return cur ?? null;
        });
    }
    if (Array.isArray(input)) return input.map(v => substitute(v, ctx));
    if (input && typeof input === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(input)) out[k] = substitute(v, ctx);
        return out;
    }
    return input;
}

/** Lấy binding cho 1 action. Admin bỏ qua. */
export function getBindingForAction(claims, action) {
    if (claims?.isAdmin) return { allowedFields: ['*'], conditions: {} };
    const b = (claims?.perms || []).find(p => p.action === action);
    if (!b) throw Object.assign(new Error('FORBIDDEN'), { code: 403 });
    return {
        allowedFields: Array.isArray(b.allowedFields) && b.allowedFields.length ? b.allowedFields : ['*'],
        conditions: substitute(b.conditions || {}, { ...claims }),
    };
}

/** Filter đọc dữ liệu (row-level): merge conditions với filter bổ sung. */
export function buildFilter(claims, action, extra = {}) {
    if (claims?.isAdmin) return extra || {};
    const { conditions } = getBindingForAction(claims, action);
    return { $and: [conditions || {}, extra || {}] };
}

/** Giới hạn field ghi (field-level). */
export function pickWritable(input, allowedFields) {
    if (!Array.isArray(allowedFields) || !allowedFields.length || allowedFields.includes('*')) return input;
    const out = {};
    for (const f of allowedFields) if (f in input) out[f] = input[f];
    return out;
}

/** Bọc Server Action (Next 15) để enforce quyền sớm. */
export function withPermAction(action, handler) {
    return async function wrapped(contextArgOrFormData, ...rest) {
        const claims = await getClaims();
        if (!claims?.uid) throw Object.assign(new Error('UNAUTHORIZED'), { code: 401 });
        const permit = getBindingForAction(claims, action); // throw nếu thiếu quyền
        return handler({ claims, ...permit }, contextArgOrFormData, ...rest);
    };
}

/** Bọc Route Handler (app/api/...) */
export function withPermRoute(action, handler) {
    return async (req, ctx) => {
        try {
            const claims = await getClaims();
            if (!claims?.uid) return new Response('Unauthorized', { status: 401 });
            const permit = getBindingForAction(claims, action);
            return await handler({ claims, ...permit }, req, ctx);
        } catch (e) {
            const status = e?.code === 401 || e?.code === 403 ? e.code : 403;
            return new Response('Forbidden', { status });
        }
    };
}

/** Helper client hiển thị/ẩn nút (không bảo mật): */
export function canClient(session, action) {
    if (session?.user?.isAdmin) return true;
    return (session?.user?.perms || []).some(p => p.action === action);
}
