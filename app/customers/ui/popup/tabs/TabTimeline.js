'use client';

import { CheckCircle2, MessageCircle, UserPlus2, PhoneCall, CalendarCheck2, ShieldCheck } from 'lucide-react';

const STEPS = [
    { idx: 1, title: 'Tiếp nhận & Xử lý', icon: CheckCircle2, badge: { text: 'Tìm thành công', color: 'bg-green-100 text-green-700' } },
    { idx: 2, title: 'Nhắn tin xác nhận', icon: MessageCircle, badge: { text: 'Gửi tin thành công', color: 'bg-green-100 text-green-700' } },
    { idx: 3, title: 'Phân bổ Telesale', icon: UserPlus2, pill: { text: 'Phân bổ: Nội khoa', color: 'bg-indigo-100 text-indigo-700' } },
    { idx: 4, title: 'Telesale Tư vấn', icon: PhoneCall },
    { idx: 5, title: 'Nhắc lịch & Xác nhận', icon: CalendarCheck2 },
    { idx: 6, title: 'Chốt dịch vụ', icon: ShieldCheck },
];

function StepRow({ idx, title, icon: Icon, badge, pill }) {
    return (
        <div className="rounded-xl border bg-white px-4 py-3">
            <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-50 grid place-items-center">
                    <Icon className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 text-sm">
                    <span className="font-medium">{idx}. {title}</span>
                </div>

                {badge && (
                    <span className={`text-xs px-2 py-1 rounded-md ${badge.color}`}>{badge.text}</span>
                )}
                {pill && (
                    <span className={`text-xs px-2 py-1 rounded-full ${pill.color}`}>{pill.text}</span>
                )}
                {/* caret giả lập ở ảnh */}
                <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M8 10l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            {/* khu hoạt động (expand sau này nếu cần) */}
            {idx === 6 && (
                <div className="mt-4 text-sm text-gray-500">
                    Chưa có hoạt động.
                </div>
            )}
        </div>
    );
}

export default function TabTimeline({ customer }) {
    return (
        <div className="flex flex-col gap-3">
            {STEPS.map(s => <StepRow key={s.idx} {...s} />)}

            {/* block dưới cùng giống ảnh (mô tả quy trình cuối) */}
            <div className="rounded-xl border bg-white p-4">
                <div className="font-semibold">Chốt Dịch Vụ & Lưu Trữ</div>
                <p className="text-sm text-gray-600 mt-1">
                    Xác nhận trạng thái cuối, doanh thu và tải lên hóa đơn/hợp đồng để hoàn tất.
                </p>
            </div>
        </div>
    );
}
