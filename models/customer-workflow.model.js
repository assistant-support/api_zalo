// app/models/customer-workflow.model.js
// ------------------------------------
// MÔ TẢ: Mongoose model cho "bản thể hiện theo khách hàng" của Workflow (Customer Workflow)
// - Mỗi khách hàng chạy 1 instance dựa theo khuôn mẫu (Workflow Template).
// - Lưu trạng thái từng bước, lịch chạy, log, và lịch sử thực thi action.
//
// LƯU Ý:
// - Dự án dùng "type": "module" => ESM import.
// - Chỉ dùng ở môi trường server (route handlers / server actions).
//
// TÍNH NĂNG CHÍNH:
// - Theo dõi status tổng thể (idle/running/paused/completed/failed/canceled).
// - Theo dõi state từng step + lịch sử actionRuns (queued/running/succeeded/...).
// - Hỗ trợ scheduling với trường nextRunAt, khoá tránh chạy trùng lockedUntil.
// - Dùng optimistic concurrency (__v) để cập nhật an toàn.

import mongoose, { Schema } from 'mongoose';

// =========================
// 1) CÁC SCHEMA CON
// =========================

// Lịch sử thực thi từng action
const ActionRunSchema = new Schema(
    {
        templateSlug: { type: String, required: true }, // lưu thêm để truy vấn/log nhanh
        stepKey: { type: String, required: true },
        actionName: { type: String, required: true },

        params: { type: Schema.Types.Mixed, default: {} },

        status: {
            type: String,
            enum: ['queued', 'running', 'succeeded', 'failed', 'skipped', 'canceled'],
            default: 'queued',
        },

        error: { type: Schema.Types.Mixed },
        startedAt: { type: Date },
        finishedAt: { type: Date },

        attempt: { type: Number, default: 0 }, // lần thử hiện tại
        scheduledFor: { type: Date },               // thời điểm dự kiến chạy (tôn trọng delayMs)
    },
    { _id: false, timestamps: true }
);

// Trạng thái của từng step trong workflow
const StepStateSchema = new Schema(
    {
        stepKey: { type: String, required: true },
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'done', 'skipped', 'canceled'],
            default: 'pending'
        },
        enteredAt: { type: Date },
        exitedAt: { type: Date },
        lastActionIndex: { type: Number, default: -1 },    // action index đã thực thi gần nhất
        localVars: { type: Schema.Types.Mixed, default: {} }, // biến riêng cho step
    },
    { _id: false }
);

// Log hoạt động
const LogSchema = new Schema(
    {
        level: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
        message: { type: String, required: true },
        meta: { type: Schema.Types.Mixed },
        at: { type: Date, default: Date.now },
    },
    { _id: false }
);

// =========================
// 2) SCHEMA CHÍNH: CUSTOMER WORKFLOW
// =========================
const CustomerWorkflowSchema = new Schema(
    {
        // Liên kết template & khách hàng
        template: { type: Schema.Types.ObjectId, ref: 'WorkflowTemplate', required: true },
        templateSlug: { type: String, required: true },  // lưu slug để truy vấn nhanh
        templateVersion: { type: Number, default: 1 },
        templateSnapshot: { type: Schema.Types.Mixed },      // chụp lại bước/hành động tại thời điểm khởi tạo

        // Tuỳ bạn: ObjectId hoặc chuỗi (VD: Zalo user id)
        customerId: { type: Schema.Types.Mixed, required: true },

        // Trạng thái tổng thể
        status: {
            type: String,
            enum: ['idle', 'running', 'paused', 'completed', 'failed', 'canceled'],
            default: 'idle',
        },

        // Step hiện tại (nếu đang chạy)
        currentStepKey: { type: String },

        // Biến runtime (sử dụng trong điều kiện/hành động)
        vars: { type: Schema.Types.Mixed, default: {} },

        // Trạng thái từng step
        steps: { type: [StepStateSchema], default: [] },

        // Lịch sử thực thi action
        actionRuns: { type: [ActionRunSchema], default: [] },

        // Nhật ký
        logs: { type: [LogSchema], default: [] },

        // Lịch & khoá tránh chạy trùng
        nextRunAt: { type: Date }, // thời điểm scheduler nên chạy instance này tiếp
        lastRunAt: { type: Date }, // lần chạy gần nhất
        lockedUntil: { type: Date }, // nếu > now => đang bị khoá
        queueKey: { type: String }, // ví dụ: `${templateSlug}:${customerId}` để xếp hàng theo khoá
    },
    {
        timestamps: true,
        minimize: false,
        optimisticConcurrency: true, // dùng __v để ngăn ghi đè race-condition
    }
);

// =========================
// 3) INDEXES (PHỤC VỤ TRA CỨU/SCHEDULER)
// =========================

// Một khách hàng + template chỉ có 1 workflow ACTIVE (không tính đã completed/canceled)
CustomerWorkflowSchema.index(
    { template: 1, customerId: 1, status: 1 },
    {
        unique: true,
        // Chỉ áp dụng unique khi status là idle/running/paused
        partialFilterExpression: { status: { $in: ['idle', 'running', 'paused'] } },
    }
);

// Truy vấn nhanh theo templateSlug + customerId
CustomerWorkflowSchema.index({ templateSlug: 1, customerId: 1 });

// Scheduler quét job sắp chạy
CustomerWorkflowSchema.index({ nextRunAt: 1 });

// =========================
// 4) METHODS TIỆN ÍCH
// =========================

// Tìm state của 1 step theo key
CustomerWorkflowSchema.methods.getStepState = function (stepKey) {
    return this.steps.find((s) => s.stepKey === stepKey);
};

// Ghi log nhanh
CustomerWorkflowSchema.methods.log = function (level, message, meta) {
    this.logs.push({ level, message, meta, at: new Date() });
};

// Thuận tiện cập nhật lock (ví dụ cho scheduler/runner)
CustomerWorkflowSchema.methods.acquireLock = async function (ms = 60_000) {
    const now = new Date();
    const until = new Date(now.getTime() + ms);

    // Dùng findOneAndUpdate với điều kiện lockedUntil <= now để khoá an toàn
    const updated = await this.constructor.findOneAndUpdate(
        {
            _id: this._id,
            $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }],
        },
        { $set: { lockedUntil: until } },
        { new: true }
    );

    return updated;
};

// =========================
// 5) EXPORT MODEL
// =========================
const MODEL_NAME = 'CustomerWorkflow';
export default mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, CustomerWorkflowSchema);
