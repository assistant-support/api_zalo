'use client';

// app/workflow/ui/action-editor.client.js
import { useEffect, useMemo, useState } from 'react';
import { iconForAction } from './action-icons.client.js';
import { useActionFeedback } from '../../../hooks/useAction.js';
import { updateFixedActionParamsAction } from '../../../data/workflow/wraperdata.db.js';
import { Save, Timer } from 'lucide-react';

const MESSAGE_ACTIONS = new Set([
    'sendZaloMessage',
    'notifyScheduleCustomer',
    'notifyGroupReminder',
    'notifyPreSurgery',
    'notifyGroupClosed',
    'notifyPostSurgery',
]);

export default function ActionEditor({ me, step, stepIndex, actionIndex = 0, onClose }) {
    const [idx, setIdx] = useState(actionIndex);
    const action = step?.actions?.[idx];
    const Icon = useMemo(() => iconForAction(action?.name), [action?.name]);
    const { run, toast } = useActionFeedback();

    // delay + fields
    const [delay, setDelay] = useState(0);
    const [message, setMessage] = useState(''); // dùng cho các action thuộc MESSAGE_ACTIONS
    const [tagName, setTagName] = useState(''); // dùng cho assignByTags

    useEffect(() => setIdx(actionIndex), [actionIndex]);

    useEffect(() => {
        if (!action) return;
        setDelay(action.delayMs ?? 0);

        // reset theo loại action
        if (MESSAGE_ACTIONS.has(action.name)) {
            setMessage(String(action?.params?.message ?? ''));
        } else {
            setMessage('');
        }
        if (action.name === 'assignByTags') {
            setTagName(String(action?.params?.tagName ?? ''));
        } else {
            setTagName('');
        }
    }, [action?.name]);

    const onSave = async () => {
        if (!step || !action) return;

        // chỉ merge những key được phép
        const params = { ...(action.params || {}) };
        if (MESSAGE_ACTIONS.has(action.name)) params.message = String(message || '');
        if (action.name === 'assignByTags') params.tagName = String(tagName || '');

        await run(updateFixedActionParamsAction, [{
            stepKey: step.key,
            actionIndex: idx,
            params,
            delayMs: Number(delay) || 0,
        }], {
            successMessage: () => 'Đã lưu hành động.',
            errorMessage: (e) => e?.error || 'Lưu thất bại.',
        });

        onClose?.();
    };

    if (!step) return <div className="text-sm text-gray-600">Không có bước nào.</div>;

    const onlyDelay =
        !MESSAGE_ACTIONS.has(action?.name) && action?.name !== 'assignByTags';

    return (
        <div className="flex flex-col md:flex-row gap-0">
            {/* Danh sách action của step */}
            <div className="md:w-64 border-r" style={{ borderColor: 'var(--border)' }}>
                <div className="p-3 font-semibold text-sm">Bước {stepIndex + 1}: {step.title}</div>
                <div className="px-2 pb-2 space-y-2">
                    {(step.actions || []).map((a, i) => {
                        const AIcon = iconForAction(a.name);
                        const active = i === idx;
                        return (
                            <button
                                key={i}
                                onClick={() => setIdx(i)}
                                className={`w-full text-left px-2 py-2 rounded-[8px] border hover:bg-gray-50 ${active ? 'ring-2 ring-blue-500' : ''}`}
                                style={{ borderColor: 'var(--border)' }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 grid place-items-center rounded bg-gray-100 border"
                                        style={{ borderColor: 'var(--border)' }}>
                                        <AIcon className="w-4 h-4 text-gray-700" />
                                    </div>
                                    <div className="text-sm truncate">{labelAction(a.name)}</div>
                                </div>
                                <div className="text-[11px] text-gray-500 ml-8">delay {a?.delayMs ?? 0}ms</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Form chỉnh nội dung + delay */}
            <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 grid place-items-center rounded-[8px] bg-gray-100 border"
                        style={{ borderColor: 'var(--border)' }}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-medium">{labelAction(action?.name)}</div>
                        <div className="text-[12px] text-gray-500">stepKey: <code>{step.key}</code></div>
                    </div>
                </div>

                {/* delay */}
                <label className="block text-sm font-medium mb-1">Thời gian trễ (delayMs)</label>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 grid place-items-center rounded-[6px] bg-gray-100 border"
                        style={{ borderColor: 'var(--border)' }}>
                        <Timer className="w-5 h-5" />
                    </div>
                    <input
                        type="number" min={0}
                        value={delay}
                        onChange={(e) => setDelay(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-[6px] border outline-none focus:ring"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="0"
                    />
                    <span className="text-sm text-gray-500">ms</span>
                </div>

                {/* message / tagName (tuỳ loại) */}
                {MESSAGE_ACTIONS.has(action?.name) && (
                    <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">Nội dung tin nhắn</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 rounded-[6px] border outline-none focus:ring text-[14px]"
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="Nhập nội dung sẽ gửi cho khách hàng..."
                        />
                    </div>
                )}

                {action?.name === 'assignByTags' && (
                    <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">Tag name (dịch vụ)</label>
                        <input
                            type="text"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                            className="w-full px-3 py-2 rounded-[6px] border outline-none focus:ring text-[14px]"
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="VD: nâng mũi, cắt mí..."
                        />
                    </div>
                )}

                {onlyDelay && (
                    <div className="text-[12px] text-gray-500 mb-2">
                        Hành động này chỉ cho phép chỉnh <b>độ trễ</b>.
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        onClick={onSave}
                        className="inline-flex items-center gap-2 rounded-[8px] px-3 py-2 border hover:bg-gray-50 text-sm"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Save className="w-4 h-4" />
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
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
