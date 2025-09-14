// import mongoose from 'mongoose';
// import Form from '@/models/formclient';
// import '@/models/customer.model'; // để populate createdBy
// import { connectMongo } from '@/lib/db_connect';
// import { cacheData } from '@/lib/cache';

// function toObjectId(id) {
//     try { return new mongoose.Types.ObjectId(id); } catch { return null; }
// }

// /**
//  * Lấy danh sách form hoặc 1 form (kèm thống kê):
//  * - customerCount: tổng số customer tham chiếu tới form (customers.source = form._id)
//  * - customerTimes: mảng thời điểm tạo của các customer (customers.createdAt)
//  * - createdBy: populate name
//  */
// async function dataForm(id) {
//     await connectMongo();

//     const matchStage = id ? [{ $match: { _id: toObjectId(id) } }] : [];

//     const pipeline = [
//         ...matchStage,
//         { $sort: { createdAt: -1 } },

//         // Lookup customers tham chiếu tới form này
//         {
//             $lookup: {
//                 from: 'customers',
//                 let: { fid: '$_id' },
//                 pipeline: [
//                     { $match: { $expr: { $eq: ['$source', '$$fid'] } } },
//                     { $project: { createdAt: 1 } }
//                 ],
//                 as: 'customers'
//             }
//         },

//         // Thêm thống kê
//         {
//             $addFields: {
//                 customerCount: { $size: '$customers' },
//                 customerTimes: {
//                     $map: { input: '$customers', as: 'c', in: '$$c.createdAt' }
//                 }
//             }
//         },

//         // Dọn output
//         { $project: { customers: 0 } },
//     ];

//     let docs = await Form.aggregate(pipeline);

//     // populate createdBy (name) trên kết quả aggregate
//     docs = await Form.populate(docs, { path: 'createdBy', select: 'name' });

//     const result = id ? (docs[0] || null) : docs;
//     return JSON.parse(JSON.stringify(result));
// }

// export async function getFormAll() {
//     const cached = cacheData(() => dataForm(), ['forms']);
//     return cached();
// }

// export async function getFormOne(id) {
//     const cached = cacheData(() => dataForm(id), ['forms', String(id)]);
//     return cached();
// }
