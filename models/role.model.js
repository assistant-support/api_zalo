
import mongoose, { Schema } from 'mongoose';

/**
 * Schema Role phiên bản nâng cấp.
 * Thay vì một 'scope' đơn giản, mỗi permission giờ đây sẽ có:
 * 1. `conditions`: Một đối tượng query của MongoDB để định nghĩa ĐIỀU KIỆN mà
 * hành động được phép thực hiện. Ví dụ: chỉ được update khách hàng do mình phụ trách.
 * 2. `allowedFields`: Một danh sách các trường được phép xem/chỉnh sửa, cung cấp
 * bảo mật ở cấp độ trường dữ liệu (field-level security).
 * Đây là một kiến trúc RBAC/ABAC mạnh mẽ, linh hoạt cho mọi loại dự án.
 */
const RoleSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    isImmutable: { type: Boolean, default: false },

    permissions: [{
        _id: false,
        permission: { type: Schema.Types.ObjectId, ref: 'Permission', required: true },

        // **ĐIỀU KIỆN LỌC DỮ LIỆU (ROW-LEVEL SECURITY)**
        // Lưu một query MongoDB. Dùng biến {{currentUser.id}} để tham chiếu động.
        // Ví dụ cho quyền update customer: { assignedTo: '{{currentUser.id}}' }
        conditions: { type: Object, default: {} }, // Mặc định là object rỗng (không có điều kiện, tức là áp dụng cho tất cả).

        // **CÁC TRƯỜNG ĐƯỢC PHÉP (FIELD-LEVEL SECURITY)**
        // Mảng các trường được phép thao tác.
        // Ví dụ cho quyền update customer: ['phone', 'address'] (không được sửa 'name' hay 'totalSpent')
        // Dùng ['*'] để cho phép tất cả các trường.
        allowedFields: { type: [String], default: [] }, // Mặc định là mảng rỗng (không được phép thao tác trường nào).
    }],
}, {
    timestamps: true,
});

const Role = mongoose.models.role || mongoose.model('role', RoleSchema);
export default Role;