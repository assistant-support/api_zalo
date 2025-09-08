'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function CostEditor({ value = [], onChange }) {
    const [rows, setRows] = useState(value);

    useEffect(() => setRows(value), [value]);       // đồng bộ khi mở form sửa
    useEffect(() => onChange?.(rows), [rows]);      // push ra cha

    const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

    const add = () => setRows(prev => [...prev, { name: '', description: '', amount: 0 }]);
    const del = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));
    const edit = (i, key, v) => setRows(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: v } : it));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-medium">Chi phí chi tiết</div>
                <button onClick={add}
                    className="inline-flex items-center gap-2 rounded-[6px] border px-3 py-1 text-sm hover:bg-[var(--primary-50)]"
                    style={{ borderColor: 'var(--border)' }}>
                    <Plus className="w-4 h-4" /> Thêm
                </button>
            </div>
            <div className="space-y-2">
                {rows.map((r, i) => (
                    <div key={i} className="grid md:grid-cols-[1fr,2fr,160px,40px] gap-2 items-start">
                        <input
                            className="rounded-[6px] border px-3 py-2"
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="Tên phí (vd: Buổi 1)"
                            value={r.name}
                            onChange={e => edit(i, 'name', e.target.value)}
                        />
                        <input
                            className="rounded-[6px] border px-3 py-2"
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="Mô tả"
                            value={r.description || ''}
                            onChange={e => edit(i, 'description', e.target.value)}
                        />
                        <input
                            type="number"
                            className="rounded-[6px] border px-3 py-2"
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="Số tiền (VND)"
                            value={r.amount}
                            onChange={e => edit(i, 'amount', e.target.value)}
                        />
                        <button
                            onClick={() => del(i)}
                            className="h-10 inline-flex items-center justify-center rounded-[6px] border hover:bg-[var(--danger-50)]"
                            style={{ borderColor: 'var(--border)' }}>
                            <Trash2 className="w-4 h-4 text-[var(--danger-700)]" />
                        </button>
                    </div>
                ))}
                {!rows.length && <div className="text-sm text-[var(--muted)]">Chưa có chi phí nào.</div>}
            </div>

            <div className="flex items-center justify-end">
                <div className="text-sm">
                    Tổng: <span className="font-semibold">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(total)}
                    </span>
                </div>
            </div>
        </div>
    );
}
