'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Toast from './Toast.client';
import CostEditor from './CostEditor.client';

const TYPES = [
    { value: 'noi_khoa', label: 'Nội khoa' },
    { value: 'ngoai_khoa', label: 'Ngoại khoa' },
];

export default function ServiceForm({ mode = 'create', initial, onCreate, onUpdate, onUpdated }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState(null);

    const [name, setName] = useState(initial?.name || '');
    const [type, setType] = useState(initial?.type || 'noi_khoa');
    const [description, setDescription] = useState(initial?.description || '');

    const [costs, setCosts] = useState(() => initial?.costs || []);
    const totalCost = useMemo(() => costs.reduce((s, c) => s + (Number(c.amount) || 0), 0), [costs]);

    const [preOp, setPreOp] = useState(() => initial?.customTexts?.preOp || { title: 'Hướng dẫn trước phẫu', content: '' });
    const [postOp, setPostOp] = useState(() => initial?.customTexts?.postOp || { title: 'Hướng dẫn sau phẫu', content: '' });
    const [documents, setDocuments] = useState(() => initial?.customTexts?.documents || []);

    const canSubmit = name.trim().length > 0 && TYPES.some(t => t.value === type);

    const onSubmit = (formData) => {
        const payload = {
            name, type, description,
            costs: JSON.stringify(costs),
            customTexts: JSON.stringify({ preOp, postOp, documents })
        };

        startTransition(async () => {
            const res = mode === 'create'
                ? await onCreate(payload)
                : await onUpdate(initial._id, payload);

            if (res?.success) {
                setToast({ type: 'success', message: mode === 'create' ? 'Tạo dịch vụ thành công.' : 'Cập nhật dịch vụ thành công.' });
                await onUpdated?.();
                router.refresh();
                if (mode === 'create') {
                    // reset nhẹ
                    setName(''); setDescription(''); setCosts([]); setPreOp({ title: 'Hướng dẫn trước phẫu', content: '' }); setPostOp({ title: 'Hướng dẫn sau phẫu', content: '' }); setDocuments([]);
                }
            } else {
                setToast({ type: 'error', message: res?.error || 'Thao tác thất bại.' });
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm text-[var(--muted)]">Tên dịch vụ</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: '0 0 0 3px transparent' }}
                        onChange={(e) => setName(e.target.value)} value={name}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-[var(--muted)]">Loại</label>
                    <select
                        className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                        onChange={(e) => setType(e.target.value)} value={type}
                    >
                        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm text-[var(--muted)]">Mô tả</label>
                <textarea
                    rows={3}
                    className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            {/* Editor chi phí */}
            <CostEditor value={costs} onChange={setCosts} />

            {/* Văn bản đặc thù */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Trước phẫu</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 mb-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Tiêu đề"
                        value={preOp.title} onChange={e => setPreOp(p => ({ ...p, title: e.target.value }))}
                    />
                    <textarea
                        rows={6}
                        className="w-full rounded-[6px] border px-3 py-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Nội dung (markdown/text)"
                        value={preOp.content} onChange={e => setPreOp(p => ({ ...p, content: e.target.value }))}
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Sau phẫu</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 mb-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Tiêu đề"
                        value={postOp.title} onChange={e => setPostOp(p => ({ ...p, title: e.target.value }))}
                    />
                    <textarea
                        rows={6}
                        className="w-full rounded-[6px] border px-3 py-2"
                        style={{ borderColor: 'var(--border)' }}
                        placeholder="Nội dung (markdown/text)"
                        value={postOp.content} onChange={e => setPostOp(p => ({ ...p, content: e.target.value }))}
                    />
                </div>
            </div>

            <DocumentsEditor value={documents} onChange={setDocuments} />

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-[var(--muted)]">
                    Tổng chi phí dự kiến: <span className="font-semibold text-[var(--primary-700)]">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalCost)}
                    </span>
                </div>
                <button
                    disabled={!canSubmit || isPending}
                    onClick={() => onSubmit()}
                    className="inline-flex items-center gap-2 rounded-[6px] px-4 py-2 font-medium"
                    style={{
                        background: 'var(--primary-600)',
                        color: 'white',
                        opacity: (!canSubmit || isPending) ? .7 : 1
                    }}
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {mode === 'create' ? 'Tạo dịch vụ' : 'Lưu thay đổi'}
                </button>
            </div>

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
}

/** Sub: documents editor cực gọn */
function DocumentsEditor({ value = [], onChange }) {
    const [docs, setDocs] = useState(value);

    useEffect(() => { onChange?.(docs); }, [docs]); // sync ra ngoài

    const add = () => setDocs(prev => [...prev, { code: '', title: '', content: '', format: 'markdown' }]);
    const del = (i) => setDocs(prev => prev.filter((_, idx) => idx !== i));
    const edit = (i, key, v) => setDocs(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: v } : it));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-medium">Văn bản đặc thù</div>
                <button onClick={add}
                    className="text-sm rounded-[6px] border px-3 py-1 hover:bg-[var(--primary-50)]"
                    style={{ borderColor: 'var(--border)' }}>
                    Thêm tài liệu
                </button>
            </div>
            <div className="space-y-4">
                {docs.map((d, i) => (
                    <div key={i} className="rounded-[6px] border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                        <div className="grid md:grid-cols-3 gap-2">
                            <input className="rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="Mã (code)" value={d.code} onChange={e => edit(i, 'code', e.target.value)} />
                            <input className="rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="Tiêu đề" value={d.title} onChange={e => edit(i, 'title', e.target.value)} />
                            <select className="rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} value={d.format} onChange={e => edit(i, 'format', e.target.value)}>
                                <option value="markdown">Markdown</option>
                                <option value="text">Text</option>
                            </select>
                        </div>
                        <textarea rows={4} className="w-full rounded-[6px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="Nội dung" value={d.content} onChange={e => edit(i, 'content', e.target.value)} />
                        <div className="flex justify-end">
                            <button onClick={() => del(i)} className="text-sm rounded-[6px] border px-3 py-1 text-[var(--danger-700)] hover:bg-[var(--danger-50)]" style={{ borderColor: 'var(--danger-200)' }}>
                                Xoá
                            </button>
                        </div>
                    </div>
                ))}
                {!docs.length && <div className="text-sm text-[var(--muted)]">Chưa có tài liệu.</div>}
            </div>
        </div>
    );
}
