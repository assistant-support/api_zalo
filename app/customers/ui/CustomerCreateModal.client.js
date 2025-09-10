'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Popup from '@/components/ui/popup';
import { submitPublicRegistrationAction } from '@/data/customers/wraperdata.db';
import { useActionFeedback } from '@/hooks/useAction'; 

const SOURCE_DIRECT_FORM_ID = '68be56c013b93cd185e9e45d';

const inputClass =
    'h-9 w-full rounded-[6px] border px-3 text-sm outline-none focus:ring-2 focus:ring-black/10 border-gray-200 bg-white';
const labelClass = 'text-xs text-gray-600 mb-1';
const rowClass = 'grid grid-cols-1 md:grid-cols-2 gap-3';

/** Dropdown có tìm kiếm cho dịch vụ */
function ServiceSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Chọn dịch vụ...',
    alwaysOpen = false,   // << thêm prop
}) {
    const wrapRef = useRef(null);
    const [open, setOpen] = useState(alwaysOpen);   // khởi tạo theo alwaysOpen
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);

    const inputClass =
        'h-9 w-full rounded-[6px] border px-3 text-sm outline-none focus:ring-2 focus:ring-black/10 border-gray-200 bg-white';

    const list = useMemo(() => {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        return options.filter(o => rx.test(o.name)).slice(0, 50);
    }, [q, options]);

    const current = useMemo(
        () => options.find(o => o._id === value) || null,
        [options, value]
    );

    // Luôn mở: đồng bộ state nếu prop thay đổi
    useEffect(() => {
        if (alwaysOpen) setOpen(true);
    }, [alwaysOpen]);

    // Đóng khi click ngoài — bỏ qua nếu alwaysOpen = true
    useEffect(() => {
        if (alwaysOpen) return;                         // << không gắn listener
        const onDoc = (e) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [alwaysOpen]);

    function onKeyDown(e) {
        const isOpen = alwaysOpen || open;
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, list.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const pick = list[active];
            if (pick) {
                onChange?.(pick._id, pick);
                if (!alwaysOpen) setOpen(false);
            }
        } else if (e.key === 'Escape') {
            if (!alwaysOpen) setOpen(false);
        }
    }

    const isOpen = alwaysOpen || open;

    return (
        <div className="relative" ref={wrapRef} onKeyDown={onKeyDown}>
            {/* Nút hiển thị giá trị hiện tại (vẫn giữ để đồng bộ UI),
          nhưng khi alwaysOpen thì bấm nút KHÔNG đóng */}
            <button
                type="button"
                className={`${inputClass} flex items-center justify-between text-left`}
                onClick={() => { if (!alwaysOpen) setOpen(v => !v); }}
                aria-expanded={isOpen}
            >
                <span className={current ? '' : 'text-gray-400'}>
                    {current ? current.name : placeholder}
                </span>
                <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-[6px] bg-white shadow-lg ring-1 ring-black/5">
                    <div className="p-2">
                        <input
                            autoFocus
                            className={`${inputClass} h-8`}
                            placeholder="Tìm dịch vụ..."
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setActive(0); }}
                        />
                    </div>
                    <div className="max-h-40 overflow-auto py-1 min-h-[40px]">
                        {list.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy</div>
                        )}
                        {list.map((o, idx) => {
                            const picked = o._id === value;
                            const activeCls = idx === active ? 'bg-gray-100' : '';
                            return (
                                <button
                                    type="button"
                                    key={o._id}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${activeCls}`}
                                    onMouseEnter={() => setActive(idx)}
                                    onClick={() => {
                                        onChange?.(o._id, o);
                                        if (!alwaysOpen) setOpen(false);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={picked ? 'font-medium' : ''}>{o.name}</span>
                                        {picked && (
                                            <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Modal thêm khách hàng (nguồn cố định hệ thống) */
export default function CustomerCreateModal({ open, onClose, onSuccess, services = [] }) {
    const { run } = useActionFeedback({
        successMessage: 'Đã thêm khách hàng.',
        errorMessage: 'Không thể tạo khách hàng.',
    });

    const [serviceId, setServiceId] = useState('');

    // reset khi mở/đóng
    useEffect(() => {
        if (!open) setServiceId('');
    }, [open]);

    async function onSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('source', SOURCE_DIRECT_FORM_ID);
        if (serviceId) formData.set('service', serviceId);

        const res = await run(submitPublicRegistrationAction, [formData]);
        if (res?.success) {
            onSuccess?.();
            onClose?.();
        }
    }

    return (
        <Popup
            open={open}
            onClose={onClose}
            header="Thêm khách hàng trực tiếp"
            widthClass="max-w-xl"
            footer={(
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 px-3 rounded-[6px] border text-sm"
                    >
                        Hủy
                    </button>
                    <button
                        form="customer-create-form"
                        type="submit"
                        className="h-9 px-3 rounded-[6px] bg-black text-white text-sm"
                    >
                        Lưu khách hàng
                    </button>
                </>
            )}
        >
            <form id="customer-create-form" onSubmit={onSubmit} className="space-y-3">
                <div className={rowClass}>
                    <div>
                        <div className={labelClass}>Họ và tên</div>
                        <input name="name" required className={inputClass} placeholder="Nguyễn Văn A" />
                    </div>

                    <div>
                        <div className={labelClass}>Dịch vụ</div>
                        <ServiceSelect
                            options={services}
                            value={serviceId}
                            onChange={(id) => setServiceId(id)}
                            placeholder="Chọn dịch vụ..."
                            alwaysOpen
                        />
                    </div>

                </div>

                <div className={rowClass}>
                    <div>
                        <div className={labelClass}>Số điện thoại</div>
                        <input name="phone" required className={inputClass} placeholder="0xxxxxxxxx" />
                    </div>
                </div>

                <div className={rowClass}>
                    <div>
                        <div className={labelClass}>Email</div>
                        <input name="email" type="email" className={inputClass} placeholder="email@domain.com" />
                    </div>

                </div>
                <div className={rowClass}>
                    <div>
                        <div className={labelClass}>Khu vực</div>
                        <input name="area" className={inputClass} placeholder="TP.HCM" />
                    </div>
                </div>
            </form>
        </Popup>
    );
}
