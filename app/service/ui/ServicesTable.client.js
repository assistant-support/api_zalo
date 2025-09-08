'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, CircleX, Loader2, Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import Popup from '@/components/ui/popup';
import Toast from './Toast.client';
import ServiceEditorForm from './ServiceEditorForm.client';
import { useActionFeedback } from '@/hooks/useAction';

export default function ServicesTable({ initialData, actions }) {
    const { createService, updateService, setServiceActive, reloadServices } = actions;

    const [q, setQ] = useState('');
    const [openCreate, setOpenCreate] = useState(false);
    const [editing, setEditing] = useState(null);

    const [toastStack, setToastStack] = useState([]);
    const pushToast = (t) => setToastStack((p) => [...p, { id: crypto.randomUUID?.() ?? String(Date.now()), ...t }]);
    const popToast = (id) => setToastStack((p) => p.filter((x) => x.id !== id));

    const act = useActionFeedback({
        successMessage: 'Thao tác thành công.',
        errorMessage: 'Có lỗi xảy ra.',
        onSuccess: async () => { await reloadServices(); },
    });

    const data = useMemo(() => {
        if (!q) return initialData;
        const s = q.toLowerCase();
        return initialData.filter((x) =>
            x.name?.toLowerCase().includes(s) ||
            x.slug?.toLowerCase().includes(s) ||
            x.type?.toLowerCase().includes(s) ||
            (x.tags || []).some((t) => (t || '').toLowerCase().includes(s))
        );
    }, [initialData, q]);

    const fmtVND = (n) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);

    const toggleActive = async (svc) => {
        const res = await act.run(setServiceActive, [svc._id, !svc.isActive], {
            successMessage: !svc.isActive ? 'Đã bật dịch vụ.' : 'Đã tắt dịch vụ.'
        });
        if (res?.success) pushToast({ type: 'success', message: act.message || 'OK' });
        else pushToast({ type: 'error', message: res?.error || 'Không thể đổi trạng thái.' });
    };

    return (
        <div className="p-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 p-3 border-b sticky top-0 bg-[var(--surface)] z-10"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 flex-1 rounded-[6px] border px-3 py-2"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <Search className="w-4 h-4 text-[var(--muted)]" />
                    <input
                        className="bg-transparent outline-none w-full placeholder:text-[var(--muted)]"
                        placeholder="Tìm theo tên, slug, tag..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setOpenCreate(true)}
                    className="inline-flex items-center gap-2 rounded-[6px] px-3 py-2 text-sm font-medium hover:brightness-110"
                    style={{ background: 'var(--primary-600)', color: 'white' }}
                >
                    <Plus className="w-4 h-4" /> Thêm dịch vụ
                </button>
                {act.loading && (
                    <div className="inline-flex items-center gap-2 text-[var(--muted)]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý…</span>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-[var(--primary-50)]">
                        <tr className="[&>th]:py-2 [&>th]:px-3 text-left">
                            <th>Tên dịch vụ</th>
                            <th className="hidden md:table-cell">Loại</th>
                            <th>Giá tổng</th>
                            <th className="hidden lg:table-cell">Lead</th>
                            <th className="hidden lg:table-cell">Trạng thái</th>
                            <th className="w-1">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {data.map((svc) => (
                            <tr key={svc._id} className="hover:bg-[var(--primary-100)] transition">
                                <td className="py-3 px-3">
                                    <div className="font-medium">{svc.name}</div>
                                    <div className="text-xs text-[var(--muted)]">{svc.slug}</div>
                                </td>
                                <td className="py-3 px-3 hidden md:table-cell">
                                    <span className="inline-flex items-center rounded-[6px] px-2 py-1 text-xs border"
                                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                                        {svc.type === 'noi_khoa' ? 'Nội khoa' : 'Ngoại khoa'}
                                    </span>
                                </td>
                                <td className="py-3 px-3">
                                    <div className="font-semibold">{fmtVND(svc.totalCost ?? svc.price)}</div>
                                </td>
                                <td className="py-3 px-3 hidden lg:table-cell">
                                    <span className="text-[var(--muted)]">{svc.leadCount ?? 0}</span>
                                </td>
                                <td className="py-3 px-3 hidden lg:table-cell">
                                    {svc.isActive ? (
                                        <span className="inline-flex items-center gap-1 text-[var(--success-600)]">
                                            <BadgeCheck className="w-4 h-4" /> Đang mở
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[var(--danger-700)]">
                                            <CircleX className="w-4 h-4" /> Đang tắt
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditing(svc)}
                                            className="inline-flex items-center gap-1 rounded-[6px] border px-2 py-1 text-xs hover:bg-[var(--primary-50)]"
                                            style={{ borderColor: 'var(--border)' }}
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => toggleActive(svc)}
                                            className="inline-flex items-center gap-1 rounded-[6px] border px-2 py-1 text-xs hover:opacity-90"
                                            style={{ borderColor: 'var(--border)' }}
                                        >
                                            {svc.isActive ? (
                                                <>
                                                    <ToggleRight className="w-4 h-4" /> Tắt
                                                </>
                                            ) : (
                                                <>
                                                    <ToggleLeft className="w-4 h-4" /> Bật
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!data.length && (
                            <tr>
                                <td colSpan={6} className="py-10 text-center text-[var(--muted)]">
                                    Không có dịch vụ nào.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create */}
            <Popup
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                header="Thêm dịch vụ"
                footer={
                    <button
                        form="service-editor-form"
                        type="submit"
                        className="rounded-[6px] px-4 py-2 font-medium hover:brightness-110"
                        style={{ background: 'var(--primary-600)', color: 'white' }}
                    >
                        Lưu
                    </button>
                }
            >
                <ServiceEditorForm
                    mode="create"
                    onSubmit={async (payload) => {
                        const res = await act.run(createService, [payload], { successMessage: 'Tạo dịch vụ thành công.' });
                        if (res?.success) {
                            pushToast({ type: 'success', message: act.message });
                            setOpenCreate(false);
                        } else {
                            pushToast({ type: 'error', message: res?.error || 'Không thể tạo dịch vụ.' });
                        }
                    }}
                />
            </Popup>

            {/* Edit */}
            <Popup
                open={!!editing}
                onClose={() => setEditing(null)}
                header="Sửa dịch vụ"
                footer={
                    <button
                        form="service-editor-form"
                        type="submit"
                        className="rounded-[6px] px-4 py-2 font-medium hover:brightness-110"
                        style={{ background: 'var(--primary-600)', color: 'white' }}
                    >
                        Lưu thay đổi
                    </button>
                }
            >
                {editing && (
                    <ServiceEditorForm
                        mode="update"
                        initial={editing}
                        onSubmit={async (payload) => {
                            const res = await act.run(updateService, [editing._id, payload], { successMessage: 'Cập nhật dịch vụ thành công.' });
                            if (res?.success) {
                                pushToast({ type: 'success', message: act.message });
                                setEditing(null);
                            } else {
                                pushToast({ type: 'error', message: res?.error || 'Không thể cập nhật dịch vụ.' });
                            }
                        }}
                    />
                )}
            </Popup>

            {/* Toaster */}
            <Toast toasts={toastStack} onClose={popToast} />
        </div>
    );
}
