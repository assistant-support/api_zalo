'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
    BadgeCheck, Calendar, CircleX, ClipboardList, Pencil, Plus, Search,
    ToggleLeft, ToggleRight, Users, ChevronDown, Link as LinkIcon, Copy
} from 'lucide-react';
import Popup from '@/components/ui/popup';
import { useActionFeedback } from '@/hooks/useAction';
import FormEditorForm from './FormEditorForm.client';

function buildFormUrl(id) {
    if (!id) return '';
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/form?id=${id}`;
}

export default function FormsTable({ initialData, actions }) {
    const { createForm, updateForm, setFormStatus, reloadForm } = actions;
    const [q, setQ] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive
    const [openCreate, setOpenCreate] = useState(false);
    const [editing, setEditing] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const act = useActionFeedback({
        successMessage: 'Thao tác thành công.',
        errorMessage: 'Có lỗi xảy ra.',
        onSuccess: async () => { await reloadForm(); },
    });

    const data = useMemo(() => {
        let list = initialData || [];
        if (q) {
            const s = q.toLowerCase();
            list = list.filter((x) =>
                x.name?.toLowerCase().includes(s) ||
                x.describe?.toLowerCase().includes(s) ||
                x.createdBy?.name?.toLowerCase().includes(s)
            );
        }
        if (statusFilter !== 'all') {
            const active = statusFilter === 'active';
            list = list.filter((x) => !!x.status === active);
        }
        return list;
    }, [initialData, q, statusFilter]);

    const fmtDate = (d) => {
        try {
            return new Intl.DateTimeFormat('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }).format(new Date(d || Date.now()));
        } catch {
            return '—';
        }
    };

    const toggleStatus = async (f) => {
        await act.run(
            setFormStatus,
            [f._id, !f.status],
            { successMessage: !f.status ? 'Đã bật form.' : 'Đã tắt form.' }
        );
    };

    const copyLink = async (f) => {
        const url = buildFormUrl(f._id);
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(f._id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            // fallback
            const tmp = document.createElement('input');
            tmp.value = url;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            document.body.removeChild(tmp);
            setCopiedId(f._id);
            setTimeout(() => setCopiedId(null), 1500);
        }
    };

    return (
        <div className="p-2 flex-1 flex flex-col" style={{ height: '100%' }}>
            {/* Toolbar */}
            <div
                className="flex flex-wrap items-center gap-3 p-1 pb-3 border-b sticky top-0 bg-[var(--surface)] z-10"
                style={{ borderColor: 'var(--border)' }}
            >
                {/* Search */}
                <div
                    className="flex items-center gap-2 flex-1 min-w-[240px] rounded-[6px] border px-3 py-2"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                >
                    <Search className="w-4 h-4 text-[var(--muted)]" />
                    <input
                        className="bg-transparent outline-none w-full placeholder:text-[var(--muted)] text-sm"
                        placeholder="Tìm theo tên, mô tả, người tạo..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>

                {/* Status filter */}
                <StatusSelect value={statusFilter} onChange={setStatusFilter} />

                <button
                    onClick={() => setOpenCreate(true)}
                    className="inline-flex items-center gap-2 rounded-[6px] px-3 py-2 text-sm font-medium hover:brightness-110"
                    style={{ background: 'var(--primary-600)', color: 'white' }}
                >
                    <Plus className="w-4 h-4" /> Thêm form
                </button>
            </div>

            {/* List */}
            <div className="mt-2 space-y-4 flex-1 scroll p-1">
                {data.map((f) => {
                    const customers = f.customerCount ?? 0;
                    const fields = Array.isArray(f.formInput) ? f.formInput.length : 0;
                    const publicUrl = buildFormUrl(f._id);

                    return (
                        <article
                            key={f._id}
                            className="rounded-[6px] border bg-[var(--surface)] text-[var(--text)] hover:ring-2 transition-shadow"
                            style={{ borderColor: 'var(--border)', '--tw-ring-color': 'var(--ring)' }}
                        >
                            <div className="grid grid-cols-1 md:[grid-template-columns:1fr_auto_280px]">
                                {/* Content (left) */}
                                <div className="p-4 md:p-5">
                                    <h3 className="text-[18px] font-semibold leading-tight">{f.name}</h3>
                                    <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">{f.describe || '—'}</p>

                                    {/* Meta */}
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                                            <Users className="w-4 h-4" />
                                            <span className="font-medium">{customers}</span>
                                            <span>khách hàng</span>
                                        </div>
                                        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                                            <ClipboardList className="w-4 h-4" />
                                            <span className="font-medium">{fields}</span>
                                            <span>trường nhập</span>
                                        </div>
                                        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                                            <Calendar className="w-4 h-4" />
                                            <span>Tạo: {fmtDate(f.createdAt)}</span>
                                        </div>
                                        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                                            <span>Người tạo:</span>
                                            <span className="font-medium">{f.createdBy?.name || '—'}</span>
                                        </div>
                                    </div>

                                    {/* Status (mobile) */}
                                    <div className="mt-3 md:hidden">
                                        {f.status ? (
                                            <span className="inline-flex items-center gap-1 text-[var(--success-600)]">
                                                <BadgeCheck className="w-4 h-4" /> Đang mở
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[var(--danger-700)]">
                                                <CircleX className="w-4 h-4" /> Đang tắt
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions (middle) */}
                                <div className="hidden md:flex items-center justify-end p-4 md:p-5">
                                    <div
                                        className="inline-flex items-stretch rounded-[8px] border overflow-hidden bg-[var(--surface-2)]"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <button
                                            onClick={() => setEditing(f)}
                                            className="px-3 py-2 text-xs font-medium hover:bg-[var(--primary-50)] border-r"
                                            style={{ borderColor: 'var(--border)' }}
                                            title="Sửa"
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <Pencil className="w-3.5 h-3.5" /> Sửa
                                            </span>
                                        </button>

                                        <a
                                            href={publicUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 text-xs font-medium hover:bg-[var(--primary-50)] border-r"
                                            style={{ borderColor: 'var(--border)' }}
                                            title="Mở trang Form"
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <LinkIcon className="w-3.5 h-3.5" /> Mở link
                                            </span>
                                        </a>

                                        <button
                                            onClick={() => copyLink(f)}
                                            className="px-3 py-2 text-xs font-medium hover:bg-[var(--primary-50)] border-r"
                                            style={{ borderColor: 'var(--border)' }}
                                            title="Sao chép link"
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <Copy className="w-3.5 h-3.5" />
                                                {copiedId === f._id ? 'Đã chép' : 'Lấy link'}
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => toggleStatus(f)}
                                            className={`px-3 py-2 text-xs font-medium hover:opacity-90 ${f.status ? 'text-[var(--danger-700)]' : 'text-[var(--success-600)]'}`}
                                            title={f.status ? 'Tắt form' : 'Bật form'}
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                {f.status ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                {f.status ? 'Tắt' : 'Bật'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Panel (right) */}
                                <div className="relative md:rounded-r-[6px] overflow-hidden bg-[var(--surface-2)] m-2 p-5">
                                    <div className="h-full w-full flex items-center justify-center">
                                        <div className="flex flex-col items-center text-center">
                                            <div
                                                className="w-14 h-14 rounded-full flex items-center justify-center mb-2"
                                                style={{ background: 'var(--primary-100)', border: '1px solid var(--border)' }}
                                            >
                                                <ClipboardList className="w-7 h-7 text-[var(--primary-700)]" />
                                            </div>
                                            {f.status ? (
                                                <span className="inline-flex items-center gap-1 text-sm text-[var(--success-600)]">
                                                    <BadgeCheck className="w-4 h-4" /> Đang mở
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-sm text-[var(--danger-700)]">
                                                    <CircleX className="w-4 h-4" /> Đang tắt
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    );
                })}

                {!data.length && (
                    <div
                        className="rounded-[6px] border p-10 text-center text-[var(--muted)]"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        Không có form nào.
                    </div>
                )}
            </div>

            {/* Create */}
            <Popup
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                header="Thêm form"
                footer={
                    <button
                        form="form-editor-form"
                        type="submit"
                        className="rounded-[6px] px-4 py-2 font-medium hover:brightness-110"
                        style={{ background: 'var(--primary-600)', color: 'white' }}
                    >
                        Lưu
                    </button>
                }
            >
                <FormEditorForm
                    mode="create"
                    onSubmit={async (payload) => {
                        const res = await act.run(
                            createForm,
                            [payload],
                            { successMessage: 'Tạo form thành công.' }
                        );
                        if (res?.success) setOpenCreate(false);
                    }}
                />
            </Popup>

            {/* Edit */}
            <Popup
                open={!!editing}
                onClose={() => setEditing(null)}
                header="Sửa form"
                footer={
                    <button
                        form="form-editor-form"
                        type="submit"
                        className="rounded-[6px] px-4 py-2 font-medium hover:brightness-110"
                        style={{ background: 'var(--primary-600)', color: 'white' }}
                    >
                        Lưu thay đổi
                    </button>
                }
            >
                {editing && (
                    <FormEditorForm
                        mode="update"
                        initial={editing}
                        onSubmit={async (payload) => {
                            const res = await act.run(
                                updateForm,
                                [editing._id, payload],
                                { successMessage: 'Cập nhật form thành công.' }
                            );
                            if (res?.success) setEditing(null);
                        }}
                    />
                )}
            </Popup>
        </div>
    );
}

/* ======================= Custom Select (Status) ======================= */
function StatusSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const items = [
        { value: 'all', label: 'Tất cả trạng thái' },
        { value: 'active', label: 'Đang mở' },
        { value: 'inactive', label: 'Đang tắt' },
    ];
    const current = items.find((i) => i.value === value) || items[0];

    useEffect(() => {
        const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('mousedown', onClick);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onClick);
            window.removeEventListener('keydown', onKey);
        };
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-[6px] border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
                {current.label}
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <div
                className={`absolute left-0 mt-2 w-[220px] rounded-[6px] border bg-[var(--surface)] shadow-lg overflow-hidden transition-all duration-150 ease-out origin-top
          ${open ? 'opacity-100 translate-y-0 scale-y-100 max-h-60' : 'opacity-0 -translate-y-1 scale-y-95 pointer-events-none max-h-0'}`}
                style={{ borderColor: 'var(--border)' }}
                role="listbox"
            >
                {items.map((it) => {
                    const active = it.value === value;
                    return (
                        <button
                            key={it.value}
                            role="option"
                            aria-selected={active}
                            onClick={() => { onChange?.(it.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors
                ${active ? 'bg-[var(--primary-50)]' : 'hover:bg-[var(--primary-50)]'}`}
                        >
                            {it.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
