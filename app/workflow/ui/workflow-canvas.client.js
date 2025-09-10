'use client';

// app/workflow/ui/workflow-canvas.client.js
import { useEffect, useRef, useState } from 'react';
import { iconForAction } from './action-icons.client.js';

/**
 * Layout:
 * - 2xl: 6 cột (1 hàng)
 * - xl:  3 cột (2 hàng)  -> connector 3→4 đi theo góc L ở khoảng cách giữa 2 hàng
 * - sm:  2 cột
 * - <sm: 1 cột
 * Connector vẽ theo toạ độ thực tế nhưng luôn route theo elbow (không cắt qua card).
 */
export default function WorkflowCanvas({ steps = [], onOpenStep }) {
    const containerRef = useRef(null);
    const itemRefs = useRef([]);
    const [lines, setLines] = useState([]);
    itemRefs.current = steps.map((_, i) => itemRefs.current[i] || null);

    const computeLines = () => {
        const c = containerRef.current;
        if (!c) return;
        const crect = c.getBoundingClientRect();
        const result = [];

        const PAD = 10; // chừa mép
        for (let i = 0; i < steps.length - 1; i++) {
            const a = itemRefs.current[i];
            const b = itemRefs.current[i + 1];
            if (!a || !b) continue;

            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();

            // cùng hàng?
            const sameRow = Math.abs(ra.top - rb.top) < ra.height * 0.3;

            if (sameRow) {
                // nối từ phải giữa của A tới trái giữa của B
                const x1 = ra.right - crect.left + PAD;
                const y1 = ra.top + ra.height / 2 - crect.top;
                const x2 = rb.left - crect.left - PAD;
                const y2 = rb.top + rb.height / 2 - crect.top;
                const mx = (x1 + x2) / 2;
                result.push({ type: 'C', pts: [x1, y1, mx, y1, mx, y2, x2, y2] });
            } else {
                // khác hàng -> đi xuống dưới A rồi sang, sau đó lên tới B (đường chữ "L" rộng rãi)
                const xStart = ra.left + ra.width * 0.5 - crect.left;
                const yStart = ra.bottom - crect.top + PAD;

                const xEnd = rb.left + rb.width * 0.5 - crect.left;
                const yEnd = rb.top - crect.top - PAD;

                const yMid = (yStart + yEnd) / 2;

                result.push({ type: 'L', pts: [xStart, yStart, xStart, yMid, xEnd, yMid, xEnd, yEnd] });
            }
        }
        setLines(result);
    };

    useEffect(() => {
        computeLines();
        const ro = new ResizeObserver(computeLines);
        const c = containerRef.current;
        if (c) ro.observe(c);
        window.addEventListener('resize', computeLines);
        const id = setInterval(computeLines, 200);
        return () => {
            window.removeEventListener('resize', computeLines);
            clearInterval(id);
            ro.disconnect();
        };
    }, [steps.length]);

    return (
        <div
            ref={containerRef}
            className="relative rounded-[10px] border bg-white/80 shadow-sm p-4 overflow-auto"
            style={{ borderColor: 'var(--border)' }}
        >
            {/* SVG connectors đặt phía sau (z-0), card phía trước (z-10) */}
            <svg className="absolute inset-0 z-0 pointer-events-none" width="100%" height="100%">
                {lines.map((l, i) =>
                    l.type === 'C' ? (
                        <path
                            key={i}
                            d={`M ${l.pts[0]} ${l.pts[1]} C ${l.pts[2]} ${l.pts[3]}, ${l.pts[4]} ${l.pts[5]}, ${l.pts[6]} ${l.pts[7]}`}
                            fill="none"
                            stroke="rgba(0,0,0,0.15)"
                            strokeWidth="2"
                        />
                    ) : (
                        <polyline
                            key={i}
                            points={`${l.pts[0]},${l.pts[1]} ${l.pts[2]},${l.pts[3]} ${l.pts[4]},${l.pts[5]} ${l.pts[6]},${l.pts[7]}`}
                            fill="none"
                            stroke="rgba(0,0,0,0.15)"
                            strokeWidth="2"
                        />
                    )
                )}
            </svg>

            {/* Grid responsive (card nằm trên, z-10) */}
            <div className="relative z-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {steps.map((step, idx) => (
                    <StepCard
                        key={step.key}
                        refCb={(el) => (itemRefs.current[idx] = el)}
                        step={step}
                        index={idx + 1}
                        onClick={() => onOpenStep?.(idx)}
                    />
                ))}
            </div>
        </div>
    );
}

function StepCard({ step, index, onClick, refCb }) {
    const firstAction = step.actions?.[0];
    const Icon = iconForAction(firstAction?.name);

    return (
        <button
            ref={refCb}
            onClick={onClick}
            className="w-full text-left rounded-[14px] border bg-white hover:shadow-md transition-shadow "
            style={{ borderColor: 'var(--border)' }}
            title="Nhấn để chỉnh sửa bước này"
        >
            <div className="p-3 flex flex-col justify-between h-full">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div
                            className="w-6 h-6 rounded-[10px] grid place-items-center bg-gray-100 border"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <Icon className="text-gray-700" style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="text-sm font-semibold leading-tight truncate">{step.title.split(':')[0]}</div>
                    </div>
                    <div className="text-[12px] text-gray-500">{step.title.split(':')[1]}</div>
                </div>
                <div className="mt-3 space-y-1">
                    {(step.actions || []).map((a, i) => {
                        const AIcon = iconForAction(a.name);
                        return (
                            <div
                                key={i}
                                className="flex items-center gap-2 px-2 py-1 rounded-[8px] bg-gray-50 border"
                                style={{ borderColor: 'var(--border)' }}
                            >
                                <div
                                    className="w-5 h-5 grid place-items-center rounded bg-white border"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <AIcon className="w-3.5 h-3.5 text-gray-700" />
                                </div>
                                <div className="text-[12px] truncate flex-1">{labelAction(a.name)}</div>
                                <div className="text-[11px] text-gray-500">delay {a?.delayMs ?? 0}ms</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </button>
    );
}

function labelAction(name = '') {
    const map = {
        findUid: 'Tìm UID',
        updateZaloName: 'Đổi tên Zalo',
        sendZaloMessage: 'Gửi tin nhắn xác nhận',
        assignByTags: 'Phân bổ theo tags',
        notifyStatus: 'Thông báo trạng thái',
        manualCall: 'Gọi điện (thủ công)',
        notifyScheduleCustomer: 'Thông báo lịch hẹn KH',
        notifyGroupReminder: 'Nhắc hẹn lên nhóm',
        notifyPreSurgery: 'Thông báo trước phẫu thuật',
        notifyGroupClosed: 'Thông báo chốt lên nhóm',
        notifyPostSurgery: 'Thông báo hậu phẫu',
    };
    return map[name] || name;
}
