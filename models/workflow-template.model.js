// app/models/workflow-template.model.js
// ------------------------------------
// MÔ TẢ: Mongoose model cho "khuôn mẫu" Workflow (Workflow Template)
// - Dùng để định nghĩa luồng tự động hoá: trigger -> steps -> actions -> transitions
// - Không gắn với khách hàng cụ thể; bản thể hiện theo khách hàng sẽ nằm ở customer-workflow.model.js
//
// LƯU Ý:
// - Dự án dùng "type": "module" => ESM import.
// - Chỉ dùng ở môi trường server (route handlers / server actions).
//
// TÍNH NĂNG CHÍNH:
// - Hỗ trợ trigger theo thời gian (cron/rrule/weekly) hoặc theo sự kiện, hoặc thủ công.
// - Mỗi step có thể chứa nhiều action, gate (điều kiện vào), và danh sách chuyển tiếp (next).
// - Thuộc tính "group" chỉ để gom nhóm hiển thị UI, không ảnh hưởng logic.
// - Validate: không cho trùng step.key; transition "to" phải trỏ tới step hợp lệ;
//   chỉ cho phép tối đa 1 transition 'else' trên mỗi step.

import mongoose, { Schema } from 'mongoose';

// =========================
// 1) CÁC SCHEMA CON
// =========================

// Điều kiện đơn: so sánh giữa "left" và "right" theo toán tử
const ConditionSchema = new Schema(
    {
        // Ví dụ: 'customer.tags', 'vars.score', 'vars.lastOrder.amount'
        left: { type: String, required: true },

        // Các loại toán tử hỗ trợ
        op: {
            type: String,
            enum: [
                'eq', 'neq', 'gt', 'gte', 'lt', 'lte',     // so sánh số/chuỗi
                'in', 'nin',                               // phần tử thuộc/không thuộc danh sách
                'contains', 'not_contains',                // chuỗi/mảng bao hàm/không bao hàm
                'exists', 'not_exists'                     // kiểm tra tồn tại (truthy/undefined/null)
            ],
            required: true,
        },

        // Giá trị so sánh bên phải (có thể là số/chuỗi/boolean/mảng/object)
        right: { type: Schema.Types.Mixed },
    },
    { _id: false }
);

// Chuyển tiếp giữa các bước: when -> to
const TransitionSchema = new Schema(
    {
        // 'always': luôn đi; 'if': phụ thuộc điều kiện; 'else': nhánh còn lại
        when: { type: String, enum: ['always', 'if', 'else'], default: 'always' },

        // điều kiện chỉ bắt buộc khi when='if'
        condition: {
            type: ConditionSchema,
            required: function () { return this.when === 'if'; },
        },

        // Khoá của step đích
        to: { type: String, required: true },
    },
    { _id: false }
);

// Hành động trong step: tên + tham số + delay + retry
const ActionSchema = new Schema(
    {
        // Ví dụ: 'sendZaloMessage', 'tagCustomer', 'httpRequest', 'wait'
        name: { type: String, required: true },

        // Tuỳ loại action mà params khác nhau
        params: { type: Schema.Types.Mixed, default: {} },

        // Độ trễ (ms) trước khi thực thi action này
        delayMs: { type: Number, default: 0, min: 0 },

        // Cấu hình retry khi lỗi
        retry: {
            attempts: { type: Number, default: 0, min: 0 }, // số lần thử lại
            backoffMs: { type: Number, default: 0, min: 0 }, // thời gian giãn cách giữa các lần thử
        },
    },
    { _id: false }
);

// Bước của workflow: có thể gom nhóm cho UI, có gate (điều kiện vào), danh sách action, và next (chuyển tiếp)
const StepSchema = new Schema(
    {
        key: { type: String, required: true }, // duy nhất trong 1 template
        title: { type: String, required: true },

        // Chỉ phục vụ UI (gom nhóm hiển thị), không ảnh hưởng logic
        group: { type: String },

        // Danh sách hành động trong step
        actions: { type: [ActionSchema], default: [] },

        // Gate: điều kiện để step này được coi là hợp lệ (ALL/ANY/NOT)
        gate: {
            type: new Schema(
                {
                    combinator: { type: String, enum: ['all', 'any', 'not'], default: 'all' },
                    conditions: { type: [ConditionSchema], default: [] },
                },
                { _id: false }
            ),
            default: undefined,
        },

        // Danh sách chuyển tiếp sang step khác
        next: { type: [TransitionSchema], default: [] },
    },
    { _id: false }
);

// Trigger: cách kích hoạt workflow template
const TriggerSchema = new Schema(
    {
        type: { type: String, enum: ['time', 'event', 'manual'], required: true },

        // Kích hoạt theo thời gian
        time: {
            cron: { type: String },                 // dùng nếu bạn điều phối qua CRON expression
            timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
            rrule: { type: String },                // dùng nếu bạn muốn RRULE (iCal)
            weekly: {
                byDay: { type: [String] },            // ví dụ: ['MO','WE']
                at: { type: String },              // ví dụ: '09:00' (HH:mm)
            },
            startAt: { type: Date },
            endAt: { type: Date },
        },

        // Kích hoạt theo sự kiện
        event: {
            eventKey: { type: String },       // ví dụ: 'zalo.message.read' hoặc 'order.paid'
            afterActionName: { type: String },       // tuỳ chọn: kích hoạt sau 1 action nào đó
            afterStepKey: { type: String },       // tuỳ chọn: kích hoạt sau 1 step nào đó
        },
    },
    { _id: false }
);

// =========================
// 2) SCHEMA CHÍNH: WORKFLOW TEMPLATE
// =========================
const WorkflowTemplateSchema = new Schema(
    {
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true }, // duy nhất để tra cứu nhanh
        description: { type: String },

        isActive: { type: Boolean, default: true },

        trigger: { type: TriggerSchema, required: true },

        // Danh sách step định nghĩa luồng
        steps: { type: [StepSchema], default: [] },

        // (tuỳ chọn) Định nghĩa schema cho biến runtime, phục vụ UI/validate phía ngoài nếu cần
        varsSchema: { type: Schema.Types.Mixed, default: {} },

        // Quản lý phiên bản template
        version: { type: Number, default: 1 },
    },
    { timestamps: true, minimize: false }
);

// =========================
// 3) VALIDATIONS & INDEXES
// =========================

// Validate: trùng step.key & transition trỏ sai
WorkflowTemplateSchema.pre('validate', function (next) {
    try {
        const keys = new Set();

        // 3.1: kiểm tra trùng step.key
        for (const s of this.steps) {
            if (keys.has(s.key)) {
                return next(new Error(`Trùng step.key: ${s.key}`));
            }
            keys.add(s.key);
        }

        // 3.2: kiểm tra transition hợp lệ + chỉ một 'else' mỗi step
        for (const s of this.steps) {
            let elseSeen = false;

            for (const tr of s.next) {
                if (!keys.has(tr.to)) {
                    return next(new Error(`Transition từ step '${s.key}' sang '${tr.to}' không tồn tại`));
                }
                if (tr.when === 'else') {
                    if (elseSeen) {
                        return next(new Error(`Step '${s.key}' có nhiều transition 'else'`));
                    }
                    elseSeen = true;
                }
            }
        }

        return next();
    } catch (err) {
        return next(err);
    }
});

// Chỉ số
WorkflowTemplateSchema.index({ slug: 1 }, { unique: true });

// =========================
// 4) EXPORT MODEL
// =========================
const MODEL_NAME = 'WorkflowTemplate';
export default mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, WorkflowTemplateSchema);
