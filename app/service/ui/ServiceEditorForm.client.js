'use client';

import { useMemo, useState } from 'react';
import CostEditor from './CostEditor.client';

const TYPES = [
    { value: 'noi_khoa', label: 'Nội khoa' },
    { value: 'ngoai_khoa', label: 'Ngoại khoa' },
];

// Form dùng chung (tạo/sửa). Nút Lưu nằm ở footer của Popup (submit bằng form id).
export default function ServiceEditorForm({ mode = 'create', initial, onSubmit }) {
    const [name, setName] = useState(initial?.name || '');
    const [type, setType] = useState(initial?.type || 'noi_khoa');
    const [description, setDescription] = useState(initial?.description || '');

    const [costs, setCosts] = useState(initial?.costs || []);
    const totalCost = useMemo(() => costs.reduce((s, c) => s + (Number(c.amount) || 0), 0), [costs]);

    const [preOp, setPreOp] = useState(initial?.customTexts?.preOp || { title: 'Hướng dẫn trước phẫu', content: '' });
    const [postOp, setPostOp] = useState(initial?.customTexts?.postOp || { title: 'Hướng dẫn sau phẫu', content: '' });
    const [documents, setDocuments] = useState(initial?.customTexts?.documents || []);
    const [expandedDocs, setExpandedDocs] = useState(false);

    const canSubmit = name.trim() && TYPES.some((t) => t.value === type);

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!canSubmit) return;
        const payload = {
            name,
            type,
            description,
            costs: JSON.stringify(costs),
            customTexts: JSON.stringify({ preOp, postOp, documents }),
        };
        await onSubmit?.(payload);
    };

    return (
        <form id="service-editor-form" onSubmit={submit} className="space-y-5">
            {/* Basic */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Tên dịch vụ</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                        value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Nâng mũi cấu trúc"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Loại</label>
                    <select
                        className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                        value={type} onChange={(e) => setType(e.target.value)}
                    >
                        {TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted)]">Mô tả</label>
                <textarea
                    rows={3}
                    className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả ngắn gọn về dịch vụ"
                />
            </div>

            {/* Costs */}
            <CostEditor value={costs} onChange={setCosts} />

            {/* Custom texts */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Pre-op */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Trước phẫu</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 mb-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Tiêu đề"
                        value={preOp.title} onChange={(e) => setPreOp((p) => ({ ...p, title: e.target.value }))}
                    />
                    <textarea
                        rows={6}
                        className="w-full rounded-[6px] border px-3 py-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Nội dung (markdown/text)"
                        value={preOp.content} onChange={(e) => setPreOp((p) => ({ ...p, content: e.target.value }))}
                    />
                </div>
                {/* Post-op */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Sau phẫu</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 mb-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Tiêu đề"
                        value={postOp.title} onChange={(e) => setPostOp((p) => ({ ...p, title: e.target.value }))}
                    />
                    <textarea
                        rows={6}
                        className="w-full rounded-[6px] border px-3 py-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Nội dung (markdown/text)"
                        value={postOp.content} onChange={(e) => setPostOp((p) => ({ ...p, content: e.target.value }))}
                    />
                </div>
            </div>

            {/* Optional documents */}
            <div className="rounded-[6px] border p-3" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setExpandedDocs((v) => !v)} className="text-sm font-medium">
                    Tài liệu đặc thù {expandedDocs ? '▲' : '▼'}
                </button>
                {expandedDocs && <Docs value={documents} onChange={setDocuments} />}
            </div>

            {/* Summary row */}
            <div className="flex items-center justify-end text-sm">
                Tổng chi phí: <span className="ml-1 font-semibold text-[var(--primary-700)]">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalCost)}
                </span>
            </div>
        </form>
    );
}

function Docs({ value = [], onChange }) {
    const [docs, setDocs] = useState(value);
    const add = () => setDocs((prev) => [...prev, { code: '', title: '', content: '', format: 'markdown' }]);
    const del = (i) => setDocs((prev) => prev.filter((_, idx) => idx !== i));
    const edit = (i, key, v) => setDocs((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)));

    // sync ra ngoài
    useMemo(() => onChange?.(docs), [docs]);

    return (
        <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--muted)]">Danh sách tài liệu</div>
                <button
                    onClick={add}
                    className="text-sm rounded-[6px] border px-3 py-1 hover:bg-[var(--primary-50)]"
                    style={{ borderColor: 'var(--border)' }}
                >
                    Thêm tài liệu
                </button>
            </div>
            {docs.map((d, i) => (
                <div key={i} className="rounded-[6px] border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="grid md:grid-cols-3 gap-2">
                        <input className="rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="Mã (code)" value={d.code} onChange={(e) => edit(i, 'code', e.target.value)} />
                        <input className="rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="Tiêu đề" value={d.title} onChange={(e) => edit(i, 'title', e.target.value)} />
                        <select className="rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} value={d.format} onChange={(e) => edit(i, 'format', e.target.value)}>
                            <option value="markdown">Markdown</option>
                            <option value="text">Text</option>
                        </select>
                    </div>
                    <textarea rows={4} className="w-full rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="Nội dung" value={d.content} onChange={(e) => edit(i, 'content', e.target.value)} />
                    <div className="flex justify-end">
                        <button
                            onClick={() => del(i)}
                            className="text-sm rounded-[6px] border px-3 py-1 text-[var(--danger-700)] hover:bg-[var(--danger-50)]"
                            style={{ borderColor: 'var(--danger-200)' }}
                        >
                            Xoá
                        </button>
                    </div>
                </div>
            ))}
            {!docs.length && <div className="text-sm text-[var(--muted)]">Chưa có tài liệu.</div>}
        </div>
    );
}
