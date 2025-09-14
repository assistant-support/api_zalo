// 'use server';
// export const runtime = 'nodejs';

// import { auth } from '@/auth';
// import {
//     loadUserAuthz,
//     evaluateAction,
//     applyRowLevel,
//     filterUpdatePayload,
// } from '@/lib/authz';

// /** Lấy đầy đủ ma trận quyền của user hiện tại */
// export async function getAuthz() {
//     const s = await auth();
//     if (!s?.user) return { isAuthenticated: false };
//     const authz = await loadUserAuthz(s.user.id);
//     return { isAuthenticated: true, user: s.user, ...authz };
// }

// /** Kiểm tra 1 action cụ thể, trả về filter row-level + danh sách field được phép */
// export async function can(action, baseFilter = {}) {
//     const s = await auth();
//     if (!s?.user) return { ok: false, status: 401, error: 'unauthenticated' };

//     const authz = await loadUserAuthz(s.user.id);
//     const rule = evaluateAction(action, authz, {
//         id: s.user.id, email: s.user.email, username: s.user.username,
//     });

//     if (!rule.granted) return { ok: false, status: 403, error: 'forbidden' };

//     const filter = applyRowLevel(baseFilter || {}, rule);
//     if (!filter) return { ok: false, status: 403, error: 'forbidden' };

//     return {
//         ok: true,
//         isAdmin: !!authz.isAdmin,
//         filter,
//         allowedFields: rule.allowedFields,
//     };
// }

// /** Lọc payload theo field-level cho 1 action */
// export async function filterFieldsFor(action, payload) {
//     const s = await auth();
//     if (!s?.user) return { ok: false, status: 401, error: 'unauthenticated' };

//     const authz = await loadUserAuthz(s.user.id);
//     const rule = evaluateAction(action, authz, {
//         id: s.user.id, email: s.user.email, username: s.user.username,
//     });
//     if (!rule.granted) return { ok: false, status: 403, error: 'forbidden' };

//     return { ok: true, data: filterUpdatePayload(payload, rule.allowedFields) };
// }

