
import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {object} Permission
 * @property {string} action - Tên định danh duy nhất cho hành động (ví dụ: 'view_users').
 * @property {string} group - Nhóm chức năng để dễ quản lý trong UI (ví dụ: 'User Management').
 * @property {string} description - Mô tả chi tiết về chức năng này.
 */

/**
 * Schema Permission định nghĩa một hành động đơn lẻ có thể được cấp phép trong hệ thống.
 * Ví dụ: xem danh sách người dùng, tạo sản phẩm, xóa bài viết.
 * Việc tách riêng model này giúp admin có thể tự định nghĩa và mở rộng các chức năng
 * có thể phân quyền mà không cần can thiệp vào mã nguồn.
 */
const PermissionSchema = new Schema({
    action: { type: String, required: true, unique: true, trim: true, index: true }, // Tên định danh duy nhất cho quyền, ví dụ: 'view_users'. Được index để tra cứu nhanh.
    group: { type: String, required: true, trim: true }, // Nhóm quyền để gom lại trên giao diện admin, ví dụ: 'User Management', 'Product Management'.
    description: { type: String, required: true }, // Mô tả chi tiết để admin hiểu rõ quyền này dùng để làm gì.
}, {
    timestamps: true,
});

const Permission = mongoose.models.permission || mongoose.model('permission', PermissionSchema);

export default Permission;
