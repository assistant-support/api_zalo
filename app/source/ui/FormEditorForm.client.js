'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Upload, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { viewUrlFromId } from '@/functions/client'; // hàm có sẵn của bạn

const fieldOptions = [
    { id: 1, label: 'Họ và Tên' },
    { id: 2, label: 'Địa chỉ' },
    { id: 3, label: 'Liên hệ' },
    { id: 4, label: 'Email' },
    { id: 5, label: 'Ngày sinh' },
    { id: 6, label: 'Dịch vụ quan tâm' },
];
const REQUIRED_IDS = [1, 3];

export default function FormEditorForm({ mode = 'create', initial, onSubmit }) {
    // Basic
    const [name, setName] = useState(initial?.name || '');
    const [describe, setDescribe] = useState(initial?.describe || '');

    // Cover upload + preview
    const initialCoverView = viewUrlFromId(initial?.cover) || '';
    const [coverPreview, setCoverPreview] = useState(initialCoverView);
    const [coverDataUrl, setCoverDataUrl] = useState('');

    const onPickFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result?.toString() || '';
            setCoverPreview(dataUrl);
            setCoverDataUrl(dataUrl); // gửi base64, server sẽ upload Drive
        };
        reader.readAsDataURL(file);
    };

    // Field selector
    const allowedIds = useMemo(() => new Set(fieldOptions.map(f => f.id)), []);
    const seedSelected = useMemo(() => {
        const raw = Array.isArray(initial?.formInput) ? initial.formInput : [];
        const filtered = raw.filter((n) => allowedIds.has(Number(n)));
        const all = Array.from(new Set([...filtered, ...REQUIRED_IDS])).map(Number);
        return all.sort((a, b) => a - b);
    }, [initial, allowedIds]);
    const [selected, setSelected] = useState(seedSelected);

    useEffect(() => { setSelected(seedSelected); }, [seedSelected]);

    const nameOk = useMemo(() => name.trim().length > 0, [name]);
    const canSubmit = nameOk;

    const toggle = (id) => {
        if (REQUIRED_IDS.includes(id)) return; // không cho bỏ chọn field bắt buộc
        setSelected((prev) => {
            const has = prev.includes(id);
            const next = has ? prev.filter((x) => x !== id) : [...prev, id];
            const withRequired = Array.from(new Set([...next, ...REQUIRED_IDS]));
            return withRequired.sort((a, b) => a - b);
        });
    };

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!canSubmit) return;
        const payload = {
            name: name.trim(),
            describe: describe.trim(),
            formInput: Array.from(new Set([...selected, ...REQUIRED_IDS]))
                .filter((n) => allowedIds.has(Number(n)))
                .map(Number)
                .sort((a, b) => a - b),
            cover: coverDataUrl || initial?.cover || '', // nếu có file mới -> dataURL; nếu không, để '' để không đổi
        };
        await onSubmit?.(payload);
    };

    return (
        <form id="form-editor-form" onSubmit={submit} className="space-y-6">
            {/* Cover upload */}
            <div className="rounded-[6px] border" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-[1fr_220px] md:grid-cols-[1fr_260px]">
                    <div className="p-3">
                        <div
                            className="relative rounded-[6px] overflow-hidden bg-[var(--surface-2)] border"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <div className="aspect-[16/9] flex items-center justify-center">
                                {coverPreview ? (
                                    <img src={coverPreview} alt="cover" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-[var(--muted)]">
                                        <div
                                            className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                                            style={{ background: 'var(--primary-100)', border: '1px solid var(--border)' }}
                                        >
                                            <ImageIcon className="w-8 h-8 text-[var(--primary-700)]" />
                                        </div>
                                        <div className="text-sm">Chưa có banner</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-3 space-y-2">
                        <label className="text-xs font-medium text-[var(--muted)]">Ảnh banner</label>
                        <label
                            className="flex items-center gap-2 rounded-[6px] border px-3 py-2 cursor-pointer hover:bg-[var(--primary-50)]"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">Chọn ảnh từ máy (1 ảnh)</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => onPickFile(e.target.files?.[0])}
                            />
                        </label>
                        <p className="text-xs text-[var(--muted)]">
                            Chỉ nhận .png, .jpg, .jpeg. Ảnh sẽ được đưa lên Drive và lưu ID vào cơ sở dữ liệu.
                        </p>
                    </div>
                </div>
            </div>

            {/* Basic fields */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Tên form</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring text-sm"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="VD: Form Zalo Ads — Landing A"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Mô tả</label>
                    <input
                        className="w-full rounded-[6px] border px-3 py-2 outline-none focus:ring text-sm"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                        value={describe}
                        onChange={(e) => setDescribe(e.target.value)}
                        placeholder="Mô tả ngắn về nguồn form"
                    />
                </div>
            </div>

            {/* Field selector */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-[var(--muted)]">Các trường yêu cầu khi nhập form</div>
                    <div className="text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Bắt buộc: Họ và Tên, Số điện thoại
                        </span>
                    </div>
                </div>

                <div className="rounded-[6px] border p-2 md:p-3" style={{ borderColor: 'var(--border)' }}>
                    <ul className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-1.5 md:gap-2">
                        {fieldOptions.map((f) => {
                            const checked = selected.includes(f.id);
                            const required = REQUIRED_IDS.includes(f.id);
                            return (
                                <li key={f.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(f.id)}
                                        disabled={required}
                                        className={`w-full text-left rounded-[8px] border px-3 py-2 flex items-center gap-3 select-none transition-colors
                      ${checked ? 'bg-[var(--primary-50)]' : 'bg-[var(--surface)]'}
                      ${required ? 'opacity-100 cursor-not-allowed' : 'hover:bg-[var(--primary-50)]'}`}
                                        style={{ borderColor: 'var(--border)' }}
                                        aria-pressed={checked}
                                    >
                                        <span
                                            className={`inline-flex h-5 w-5 items-center justify-center rounded-[4px] border
                        ${checked ? 'bg-[var(--primary-600)] text-white border-transparent' : 'bg-[var(--surface)]'}`}
                                            style={{ borderColor: checked ? 'transparent' : 'var(--border)' }}
                                        >
                                            {checked && <Check className="w-3.5 h-3.5" />}
                                        </span>
                                        <span className="flex-1 text-sm">{f.label}</span>
                                        {required && (
                                            <span
                                                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[4px] border"
                                                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--muted)' }}
                                            >
                                                Bắt buộc
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <p className="text-xs text-[var(--muted)]">
                    *Hai trường <b>Họ và Tên</b> và <b>Số điện thoại</b> luôn bắt buộc.
                </p>
            </div>
        </form>
    );
}
