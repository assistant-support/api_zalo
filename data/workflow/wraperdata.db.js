// 'use server';
// // data/workflows/actions.db.js
// // -------------------------------------------------------------
// // SERVER ACTIONS cho Workflow/CustomerWorkflow
// // - RBAC: kiểm tra bằng getSessionUserLite()
// // - Sau khi ghi DB: revalidate tag liên quan để các phiên khác cập nhật
// // - Chỉ cho user thường sửa params/delayMs của action trong template cố định

// import mongoose from 'mongoose';
// import { revalidateTag } from 'next/cache';

// import { getSessionUserLite } from '@/app/actions/session.action';
// import { connectMongo } from '@/lib/db_connect';

// import WorkflowTemplate from '@/models/workflow-template.model.js';
// import CustomerWorkflow from '@/models/customer-workflow.model.js';
// import Customer from '@/models/customer.model.js';

// import {
//     WF_TAGS,
//     revalidateWorkflowTemplate,
//     revalidateCustomer,
//     revalidateCustomerWorkflows,
// } from './handledata.db';

// const FIXED_SLUG = 'fixed-6-steps';

// function toObjectId(id) {
//     try { return new mongoose.Types.ObjectId(id); } catch { return null; }
// }
// async function requireDb() { await connectMongo(); }
// async function requireUser() {
//     const me = await getSessionUserLite();
//     if (!me) throw new Error('Bạn chưa đăng nhập');
//     return me;
// }
// function isAdmin(me) { return me?.role === 'admin'; }

// // -------------------------------------------------------------
// // 1) CẬP NHẬT PARAMS/DELAY CỦA ACTION TRONG TEMPLATE CỐ ĐỊNH
// //    - admin: OK
// //    - non-admin: chỉ được sửa params + delayMs
// // -------------------------------------------------------------
// export async function updateFixedActionParamsAction({ stepKey, actionIndex, params, delayMs }) {
//     await requireDb();
//     const me = await requireUser();

//     if (delayMs != null && (typeof delayMs !== 'number' || delayMs < 0)) {
//         throw new Error('delayMs không hợp lệ');
//     }

//     const tmpl = await WorkflowTemplate.findOne({ slug: FIXED_SLUG });
//     if (!tmpl) throw new Error('Template cố định chưa tồn tại');

//     const step = tmpl.steps.find((s) => s.key === stepKey);
//     if (!step) throw new Error('Không tìm thấy step');

//     const action = step.actions[actionIndex];
//     if (!action) throw new Error('Không tìm thấy action trong step');

//     // Non-admin: chỉ được đổi params/delayMs (đoạn này đã giới hạn theo input)
//     if (params && typeof params === 'object') action.params = params;
//     if (delayMs != null) action.delayMs = delayMs;

//     await tmpl.save();

//     // retag
//     revalidateWorkflowTemplate(FIXED_SLUG);
//     return { ok: true };
// }

// // -------------------------------------------------------------
// // 2) GÁN TEMPLATE (bất kỳ) VÀO CUSTOMER -> TẠO INSTANCE
// //    - Cho phép nhiều workflow chạy song song theo yêu cầu
// // -------------------------------------------------------------
// export async function assignTemplateToCustomerAction({ templateSlug, customerId }) {
//     await requireDb();
//     const me = await requireUser();
//     if (!templateSlug || !customerId) throw new Error('Thiếu tham số');

//     const tmpl = await WorkflowTemplate.findOne({ slug: templateSlug });
//     if (!tmpl) throw new Error('Không tìm thấy template');

//     const cw = await CustomerWorkflow.create({
//         template: tmpl._id,
//         templateSlug: tmpl.slug,
//         templateVersion: tmpl.version,
//         templateSnapshot: tmpl.toObject(),
//         customerId,
//         status: 'idle',
//         currentStepKey: tmpl.steps?.[0]?.key || null,
//         steps: (tmpl.steps || []).map((s) => ({
//             stepKey: s.key,
//             status: 'pending',
//             lastActionIndex: -1,
//             localVars: {},
//         })),
//         vars: {},
//         logs: [],
//         nextRunAt: null,
//         lastRunAt: null,
//         lockedUntil: null,
//         queueKey: `${tmpl.slug}:${customerId}:${Date.now()}`,
//     });

//     revalidateTag(WF_TAGS.CW_LIST(customerId));
//     return { ok: true, id: String(cw._id) };
// }

// // -------------------------------------------------------------
// // 3) GHI CARE VÀO CUSTOMER (log chăm sóc)
// // -------------------------------------------------------------
// export async function appendCustomerCareAction({ customerId, content, step = 0 }) {
//     await requireDb();
//     const me = await requireUser();

//     const customer = await Customer.findById(customerId);
//     if (!customer) throw new Error('Không tìm thấy khách hàng');

//     customer.care = customer.care || [];
//     customer.care.push({
//         content: String(content || '').slice(0, 2000),
//         step: Number(step) || 0,
//         createBy: toObjectId(me.id),
//         createAt: new Date(),
//     });
//     await customer.save();

//     revalidateCustomer(customerId);
//     return { ok: true };
// }
