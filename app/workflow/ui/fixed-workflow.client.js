'use client';

// app/workflow/ui/fixed-workflow.client.js
import { useMemo, useState } from 'react';
import Link from 'next/link';
import WorkflowCanvas from './workflow-canvas.client.js';
import ActionEditor from './action-editor.client.js';
import Popup from '../../../components/ui/popup.js';
import { AlertCircle, Plus } from 'lucide-react';

export default function FixedWorkflowClient({ me, template }) {
    const steps = useMemo(() => template?.steps || [], [template]);
    const isAdmin = me?.role === 'admin';

    const [open, setOpen] = useState(false);
    const [sel, setSel] = useState({ stepIndex: 0, actionIndex: 0 });

    const openStep = (stepIndex) => {
        setSel({ stepIndex, actionIndex: 0 });
        setOpen(true);
    };

    if (!template) {
        return (
            <div className="rounded-[10px] border p-6 bg-white/80 shadow-sm" style={{ borderColor: 'var(--border)' }}>
                <div className="text-lg font-semibold mb-2">Workflow cố định chưa được khởi tạo</div>
                <p className="text-sm text-gray-600 mb-4">Nhấn vào liên kết dưới để tạo dữ liệu 6 bước theo yêu cầu.</p>
                <Link
                    href="/api/workflow/fixed"
                    className="inline-flex items-center gap-2 rounded-[8px] px-3 py-2 border text-sm hover:bg-gray-50"
                    style={{ borderColor: 'var(--border)' }}
                >
                    <Plus className="w-4 h-4" />
                    Tạo workflow cố định
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <div className="text-[13px] text-gray-500">Workflow</div>
                    <h1 className="text-xl font-semibold">
                        {template.name}{' '}
                    </h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="px-2 py-1 rounded-[8px] border bg-white/60" style={{ borderColor: 'var(--border)' }}>
                        <b>Chế độ:</b> {me?.role == 'sale' ? 'Chỉ xem' : 'Chỉnh sửa bước'}
                    </span>
                    <span className="px-2 py-1 rounded-[8px] border bg-white/60" style={{ borderColor: 'var(--border)' }}>
                        <b>Quyền:</b> {me?.role || 'sale'}
                    </span>
                </div>
            </div>

            {/* Canvas: click step -> mở Popup chỉnh sửa */}
            <WorkflowCanvas steps={steps} onOpenStep={openStep} />

            {!isAdmin && (
                <div className="flex items-center gap-2 text-[12px] text-amber-700">
                    <AlertCircle className="w-4 h-4" />
                    Bạn chỉ có thể cập nhật <b className="mx-1">nội dung tin nhắn</b>&<b className="mx-1">tag name</b> (nếu có).
                    Các hành động khác chỉ được chỉnh<b className="mx-1">độ trễ</b>. Cấu trúc workflow cố định không thể thay đổi tại đây.
                </div>
            )}

            {/* Popup chỉnh sửa */}
            <Popup
                open={open}
                onClose={() => setOpen(false)}
                header={template.steps?.[sel.stepIndex]?.title || 'Chỉnh sửa bước'}
                widthClass="max-w-4xl"
            >
                <ActionEditor
                    me={me}
                    step={template.steps?.[sel.stepIndex]}
                    stepIndex={sel.stepIndex}
                    actionIndex={sel.actionIndex}
                    onClose={() => setOpen(false)}
                />
            </Popup>
        </div>
    );
}
