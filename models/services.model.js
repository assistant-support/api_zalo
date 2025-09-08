// models/services.model.js
import { Schema, model, models } from 'mongoose';

function toSlug(input) {
    return String(input)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

/** Dịch vụ (catalog) + cấu hình tài liệu/hướng dẫn đặc thù */
const serviceSchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    // nội khoa / ngoại khoa
    type: { type: String, enum: ['noi_khoa', 'ngoai_khoa'], required: true, index: true },

    // mô tả ngắn cho catalog
    description: { type: String },

    // Chiều chi phí nhỏ: tên, mô tả, số tiền (VNĐ)
    costs: [{
        name: { type: String, required: true, trim: true },         // vd: "Phí thuốc", "Buổi 1", ...
        description: { type: String },
        amount: { type: Number, required: true, min: 0 }
    }],

    // snapshot tổng (để lọc/hiển thị nhanh). Luôn tính từ costs trước khi save.
    price: { type: Number, min: 0, default: 0 },

    // Cấu hình văn bản đặc thù theo từng dịch vụ
    // Bạn có thể dùng markdown hoặc plain text
    customTexts: {
        preOp: {                                         // Hướng dẫn trước phẫu
            title: { type: String, default: 'Hướng dẫn trước phẫu' },
            content: { type: String, default: '' }
        },
        postOp: {                                        // Hướng dẫn sau phẫu
            title: { type: String, default: 'Hướng dẫn sau phẫu' },
            content: { type: String, default: '' }
        },
        // các văn bản khác (tùy ý): code để nhận diện, title để hiển thị
        documents: [{
            code: { type: String, required: true, trim: true }, // vd: "cam_ket", "cham_soc_vet_thuong"
            title: { type: String, required: true },
            content: { type: String, default: '' },             // markdown/text
            format: { type: String, enum: ['markdown', 'text'], default: 'markdown' }
        }]
    },

    // Trạng thái dùng/ẩn (soft delete)
    isActive: { type: Boolean, default: true, index: true },

    // Tag tìm kiếm/marketing (tùy chọn)
    tags: { type: [String], default: [], index: true }
}, { timestamps: true });

serviceSchema.pre('validate', function (next) {
    if (!this.slug && this.name) this.slug = toSlug(this.name);
    // auto snapshot price
    if (Array.isArray(this.costs)) {
        this.price = this.costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    }
    next();
});

serviceSchema.index({ name: 'text', description: 'text', tags: 'text' });

const Service = models.Service || model('Service', serviceSchema);
export default Service;
