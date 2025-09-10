// app/api/workflow/fixed/route.js
// ------------------------------------
// API KHỞI TẠO TEMPLATE CỐ ĐỊNH 6 BƯỚC (idempotent).
// YÊU CẦU: không kiểm tra quyền theo mô tả của bạn.
// Truy cập: GET /api/workflow/fixed
//
// Lưu ý: chỉ tạo nếu chưa tồn tại slug 'fixed-6-steps'.
// Sau khi tạo xong có revalidate tag để các trang hiển thị ngay bản mới.

import { NextResponse } from 'next/server';
import WorkflowTemplate from '@/models/workflow-template.model.js';
import { connectMongo } from '@/lib/db_connect.js';
import { revalidateWorkflowTemplate } from '@/lib/cache-tags';

const FIXED_SLUG = 'fixed-6-steps';

export async function GET() {
    await connectMongo();

    let existed = await WorkflowTemplate.findOne({ slug: FIXED_SLUG });
    if (existed) {
        return NextResponse.json({ ok: true, created: false, slug: FIXED_SLUG, _id: existed._id }, { status: 200 });
    }

    // Định nghĩa 6 bước cố định theo mô tả
    const steps = [
        {
            key: 's1-find-uid',
            title: 'Bước 1: Tìm UID + Đổi tên Zalo',
            group: 'Cố định',
            actions: [
                { name: 'findUid', params: { channel: 'zalo' }, delayMs: 0 },
                // chỉ chạy khi đã có uid (runner sẽ kiểm tra params.requires)
                { name: 'updateZaloName', params: { from: 'zalo', requires: ['customer.uid'] }, delayMs: 0 },
            ],
            next: [{ when: 'always', to: 's2-confirm-message' }],
        },
        {
            key: 's2-confirm-message',
            title: 'Bước 2: Gửi tin nhắn xác nhận',
            group: 'Cố định',
            actions: [
                { name: 'sendZaloMessage', params: { kind: 'confirm', requires: ['customer.uid'] }, delayMs: 0 },
            ],
            next: [{ when: 'always', to: 's3-assign-and-notify' }],
        },
        {
            key: 's3-assign-and-notify',
            title: 'Bước 3: Phân bổ + Thông báo trạng thái 1-2-3',
            group: 'Cố định',
            actions: [
                // chỉ phân bổ khi có tags
                { name: 'assignByTags', params: { requires: ['customer.tags'] }, delayMs: 0 },
                { name: 'notifyStatus', params: { includeSteps: [1, 2, 3] }, delayMs: 0 },
            ],
            next: [{ when: 'always', to: 's4-manual-call' }],
        },
        {
            key: 's4-manual-call',
            title: 'Bước 4: Gọi điện (thủ công)',
            group: 'Cố định',
            actions: [
                // Không thực thi gì, chỉ để hiển thị icon/note thủ công
                { name: 'manualCall', params: { note: 'Cập nhật thủ công sau khi gọi' }, delayMs: 0 },
            ],
            next: [{ when: 'always', to: 's5-schedule-notifications' }],
        },
        {
            key: 's5-schedule-notifications',
            title: 'Bước 5: Thông báo lịch hẹn/nhắc hẹn/trước phẫu thuật',
            group: 'Cố định',
            actions: [
                { name: 'notifyScheduleCustomer', params: {}, delayMs: 0 },
                { name: 'notifyGroupReminder', params: {}, delayMs: 0 },
                { name: 'notifyPreSurgery', params: {}, delayMs: 0 },
            ],
            next: [{ when: 'always', to: 's6-close-and-postop' }],
        },
        {
            key: 's6-close-and-postop',
            title: 'Bước 6: Chốt dịch vụ + Hậu phẫu',
            group: 'Cố định',
            actions: [
                { name: 'notifyGroupClosed', params: { event: 'service_closed' }, delayMs: 0 },
                { name: 'notifyPostSurgery', params: {}, delayMs: 0 },
            ],
            next: [], // kết thúc
        },
    ];

    const doc = await WorkflowTemplate.create({
        name: 'Workflow cố định 6 bước',
        slug: FIXED_SLUG,
        description: 'Chuỗi chăm sóc gồm 6 bước cố định',
        isActive: true,
        trigger: { type: 'manual' }, // khởi tạo instance thủ công hoặc do code
        steps,
        varsSchema: {
            // gợi ý schema biến runtime (runner sẽ tùy biến dùng)
            uid: 'string?',
            tags: 'string[]?',
        },
        version: 1,
    });

    // Revalidate tag để các màn hình đang mở nhận dữ liệu mới
    revalidateWorkflowTemplate(FIXED_SLUG);

    return NextResponse.json({ ok: true, created: true, slug: FIXED_SLUG, _id: doc._id }, { status: 201 });
}
