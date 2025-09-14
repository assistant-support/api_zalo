// // data/customers/handledata.db.js
// import mongoose from 'mongoose';
// import { connectMongo } from '@/lib/db_connect';
// import Customer from '../../models/cu';

// function toObjectId(id) {
//     try { return new mongoose.Types.ObjectId(id); } catch { return null; }
// }
// function ensureArray(v) {
//     if (!v) return [];
//     return Array.isArray(v) ? v : [v];
// }
// function clampPageSize(n) {
//     const allowed = [10, 50, 100];
//     const num = Number(n) || 10;
//     return allowed.includes(num) ? num : 10;
// }

// /**
//  * Tạo $match từ bộ lọc + scope theo role
//  * @param {Object} filters - các bộ lọc mức thấp (đã chuẩn hóa)
//  * @param {Object} scope   - { restrictToAssigneeUserId?: ObjectId }
//  */
// function buildMatch(filters = {}, scope = {}) {
//     const $and = [];

//     // Scope theo role = sale → chỉ thấy KH mà assignees.user = viewerId
//     if (scope?.restrictToAssigneeUserId) {
//         $and.push({ 'assignees.user': scope.restrictToAssigneeUserId });
//     }

//     // Lọc theo id cụ thể
//     if (filters.id) $and.push({ _id: toObjectId(filters.id) });

//     // Lọc assignee cụ thể (quản trị có thể xem theo người khác)
//     if (filters.assigneeId) $and.push({ 'assignees.user': toObjectId(filters.assigneeId) });

//     // Lọc theo form/source
//     if (filters.sourceId) $and.push({ source: toObjectId(filters.sourceId) });

//     // Lọc theo tags (dịch vụ)
//     if (filters.tagIds?.length) $and.push({ tags: { $in: filters.tagIds.map(toObjectId).filter(Boolean) } });

//     // Lọc theo phase
//     if (filters.zaloPhase) $and.push({ zaloPhase: filters.zaloPhase });

//     // Lọc theo status (string hoặc mảng)
//     if (filters.pipelineStatuses?.length) {
//         // schema của bạn khai báo pipelineStatus là type: [String] → dùng $in
//         $and.push({ pipelineStatus: { $in: filters.pipelineStatuses } });
//     }

//     // Lọc theo thời gian tạo
//     if (filters.createdFrom || filters.createdTo) {
//         const r = {};
//         if (filters.createdFrom) r.$gte = new Date(filters.createdFrom);
//         if (filters.createdTo) r.$lte = new Date(filters.createdTo);
//         $and.push({ createAt: r });
//     }

//     // Full-text nhẹ: name/phone/email/area/sourceDetails/zaloname
//     if (filters.q) {
//         const rx = new RegExp(String(filters.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
//         $and.push({
//             $or: [
//                 { name: rx },
//                 { phone: rx },
//                 { email: rx },
//                 { area: rx },
//                 { sourceDetails: rx },
//                 { zaloname: rx },
//             ],
//         });
//     }

//     // hasCare: true/false
//     if (typeof filters.hasCare === 'boolean') {
//         if (filters.hasCare) $and.push({ $expr: { $gt: [{ $size: { $ifNull: ['$care', []] } }, 0] } });
//         else $and.push({ $expr: { $eq: [{ $size: { $ifNull: ['$care', []] } }, 0] } });
//     }

//     return $and.length ? { $and } : {};
// }

// function buildSort(sortKey = '-createAt') {
//     // Hỗ trợ: -createAt, createAt, -lastCareAt, lastCareAt, name, -revenue (serviceDetails.revenue)
//     const dir = sortKey.startsWith('-') ? -1 : 1;
//     const key = sortKey.replace(/^-/, '');
//     const map = {
//         createAt: 'createAt',
//         lastCareAt: 'lastCareAt',
//         name: 'name',
//         revenue: 'serviceDetails.revenue',
//     };
//     const field = map[key] || 'createAt';
//     return { [field]: dir };
// }

// /**
//  * Truy vấn danh sách khách hàng + phân trang + đếm tổng
//  * Trả về: { items, total, page, pageSize, hasMore }
//  */
// export async function queryCustomersList({
//     filters = {},
//     scope = {},
//     page = 1,
//     pageSize = 10,
//     sort = '-createAt',
// } = {}) {
//     await connectMongo();

//     const skip = Math.max(0, (Number(page) || 1) - 1) * clampPageSize(pageSize);
//     const limit = clampPageSize(pageSize);

//     const match = buildMatch(filters, scope);
//     const sortStage = buildSort(sort);

//     const pipeline = [
//         { $match: match },

//         // Tính nhanh careCount / lastCareAt
//         {
//             $addFields: {
//                 careCount: { $size: { $ifNull: ['$care', []] } },
//                 lastCareAt: {
//                     $max: {
//                         $map: {
//                             input: { $ifNull: ['$care', []] },
//                             as: 'c',
//                             in: '$$c.createAt',
//                         },
//                     },
//                 },
//             },
//         },

//         // Đưa vào facet để lấy total + page data trong 1 round-trip
//         {
//             $facet: {
//                 data: [
//                     { $sort: sortStage },
//                     { $skip: skip },
//                     { $limit: limit },
//                 ],
//                 meta: [
//                     { $count: 'total' },
//                 ],
//             },
//         },
//         {
//             $project: {
//                 data: 1,
//                 total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
//             },
//         },
//     ];

//     let [{ data: docs, total = 0 } = { data: [], total: 0 }] = await Customer.aggregate(pipeline);

//     // Populate sau aggregate (nhẹ hơn)
//     docs = await Customer.populate(docs, [
//         { path: 'source', select: 'name' },
//         { path: 'assignees.user', select: 'name email avatar' },
//         { path: 'roles', select: 'name email avatar' },
//         { path: 'tags', select: 'name type' },
//         { path: 'serviceDetails.closedBy', select: 'name email' },
//         { path: 'uid.zalo', select: 'name email' },
//     ]);

//     const items = JSON.parse(JSON.stringify(docs));
//     const pages = limit ? Math.ceil(total / limit) : 1;
//     return {
//         items,
//         total,
//         page: Number(page) || 1,
//         pageSize: limit,
//         pages,
//         hasMore: (Number(page) || 1) < pages,
//     };
// }

// /** Lấy 1 khách hàng theo id (giữ nguyên populate giống list) */
// export async function queryCustomerOne(id, scope = {}) {
//     await connectMongo();
//     const match = buildMatch({ id }, scope);
//     const base = await Customer.aggregate([
//         { $match: match },
//         {
//             $addFields: {
//                 careCount: { $size: { $ifNull: ['$care', []] } },
//                 lastCareAt: {
//                     $max: {
//                         $map: {
//                             input: { $ifNull: ['$care', []] },
//                             as: 'c',
//                             in: '$$c.createAt',
//                         },
//                     },
//                 },
//             },
//         },
//         { $limit: 1 },
//     ]);
//     let doc = base?.[0] || null;
//     if (!doc) return null;

//     doc = await Customer.populate(doc, [
//         { path: 'source', select: 'name' },
//         { path: 'assignees.user', select: 'name email avatar' },
//         { path: 'roles', select: 'name email avatar' },
//         { path: 'tags', select: 'name type' },
//         { path: 'serviceDetails.closedBy', select: 'name email' },
//         { path: 'uid.zalo', select: 'name email' },
//     ]);

//     return JSON.parse(JSON.stringify(doc));
// }
