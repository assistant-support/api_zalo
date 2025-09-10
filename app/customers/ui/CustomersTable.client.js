// app/customers/ui/CustomersTable.client.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Filter, Settings, Plus, X
} from 'lucide-react';
import CustomerCareModal from './popup/CustomerDetailPopup.client';
import CustomerCreateModal from './CustomerCreateModal.client';

const PAGE_SIZES = [10, 50, 100];

// ======= Status/Phase options (UI đẹp, không phải nhập tay) =======
const PIPELINE_OPTIONS = [
    'new_unconfirmed_1', 'missing_info_1', 'not_valid_1', 'msg_success_2', 'msg_error_2', 'duplicate_merged_1',
    'rejected_immediate_1', 'valid_1', 'noikhoa_3', 'ngoaikhoa_3', 'undetermined_3', 'consulted_pending_4',
    'scheduled_unconfirmed_4', 'callback_4', 'not_interested_4', 'no_contact_4', 'confirmed_5', 'postponed_5',
    'canceled_5', 'serviced_completed_6', 'serviced_in_progress_6', 'rejected_after_consult_6'
];
const PHASE_OPTIONS = ['welcome', 'nurturing', 'pre_surgery', 'post_surgery', 'longterm'];

const DEFAULT_COLUMNS = [
    { key: 'select', label: '', fixed: true },
    { key: 'idx', label: '#', fixed: true },
    { key: 'name', label: 'Họ tên' },
    { key: 'phone', label: 'SĐT' },
    { key: 'source', label: 'Nguồn' },
    { key: 'zaloname', label: 'Zalo' },
    { key: 'zaloPhase', label: 'Phase' },
    { key: 'pipelineStatus', label: 'Trạng thái' },
    { key: 'careCount', label: 'Care' },
    { key: 'lastCareAt', label: 'Lần care' },
    { key: 'revenue', label: 'Doanh thu' },
];

function classNames(...a) { return a.filter(Boolean).join(' '); }

// Số cột dữ liệu tối đa phụ thuộc viewport (không tính select + idx)
function maxDataCols(width) {
    // ≥2000px: 6 cột; 1280–1999: 5; 1024–1279: 4; 768–1023: 3; <768: 2
    if (width >= 2000) return 6;
    if (width >= 1280) return 5;
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    return 2;
}

function useWindowWidth() {
    const [w, setW] = useState(typeof window === 'undefined' ? 1920 : window.innerWidth);
    useEffect(() => {
        function onResize() { setW(window.innerWidth); }
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return w;
}

function Input({ className, ...props }) {
    return <input className={classNames('h-9 rounded-[6px] border px-3 text-sm border-gray-200 outline-none focus:ring-2 focus:ring-black/10 bg-white', className)} {...props} />;
}
function Select({ className, children, ...props }) {
    return (
        <select className={classNames('h-9 rounded-[6px] border px-2 text-sm border-gray-200 outline-none focus:ring-2 focus:ring-black/10 bg-white', className)} {...props}>
            {children}
        </select>
    );
}

export default function CustomersTable({ initialData, initialParams, initialMeta, service }) {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();
    const width = useWindowWidth();

    const [rows, setRows] = useState(initialData || []);
    const [meta, setMeta] = useState(initialMeta || { total: 0, page: 1, pageSize: 10, pages: 1, hasMore: false, sort: '-createAt' });
    const [params, setParams] = useState(initialParams || { scope: 'mine', q: '', status: '', phase: '', tag: '', page: 1, size: 10 });
    const [selected, setSelected] = useState(new Set());
    const [careOpen, setCareOpen] = useState(false);
    const [careCustomer, setCareCustomer] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [colOpen, setColOpen] = useState(false);

    // Cấu hình cột (ngoại trừ 2 cột cố định)
    const [columnKeys, setColumnKeys] = useState(() => {
        // mặc định bật toàn bộ data columns
        return DEFAULT_COLUMNS.map(c => c.key);
    });

    // Giới hạn số cột dữ liệu thực sự hiển thị
    const visibleColumns = useMemo(() => {
        const fixed = DEFAULT_COLUMNS.filter(c => c.fixed);
        const dataCols = DEFAULT_COLUMNS.filter(c => !c.fixed && columnKeys.includes(c.key));
        const cap = maxDataCols(width);
        return [...fixed, ...dataCols.slice(0, cap)];
    }, [columnKeys, width]);

    useEffect(() => { setRows(initialData || []); }, [initialData]);
    useEffect(() => { setMeta(initialMeta || meta); }, [initialMeta]); // eslint-disable-line

    // Đồng bộ URL
    useEffect(() => {
        const query = new URLSearchParams(sp.toString());
        query.set('scope', params.scope || 'mine');
        query.set('q', params.q || '');
        query.set('status', params.status || '');
        query.set('phase', params.phase || '');
        query.set('tag', params.tag || '');
        query.set('page', String(params.page || 1));
        query.set('size', String(params.size || 10));
        router.replace(`${pathname}?${query.toString()}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.scope, params.q, params.status, params.phase, params.tag, params.page, params.size]);

    // Chọn
    const allChecked = rows.length > 0 && rows.every(r => selected.has(r._id));
    const someChecked = rows.some(r => selected.has(r._id)) && !allChecked;
    function toggleAll() {
        const ns = new Set(selected);
        if (allChecked) rows.forEach(r => ns.delete(r._id));
        else rows.forEach(r => ns.add(r._id));
        setSelected(ns);
    }
    function toggleOne(id) {
        const ns = new Set(selected);
        if (ns.has(id)) ns.delete(id); else ns.add(id);
        setSelected(ns);
    }

    function goPage(p) {
        const next = Math.max(1, Math.min(meta.pages || 1, p));
        setParams(prev => ({ ...prev, page: next }));
    }
    function changeSize(sz) {
        setParams(prev => ({ ...prev, size: Number(sz), page: 1 }));
    }

    function openCare(row) {
        setCareCustomer(row);
        setCareOpen(true);
    }

    function onSubmitFilter(e) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setParams(prev => ({
            ...prev,
            scope: fd.get('scope') || 'mine',
            q: fd.get('q') || '',
            status: fd.get('status') || '',
            phase: fd.get('phase') || '',
            tag: fd.get('tag') || '',
            page: 1,
        }));
    }

    const money = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');
    const fmtDate = (v) => v ? new Date(v).toLocaleString() : '—';

    // ===== Column picker (ảnh hưởng cả header + body) =====
    function toggleCol(key) {
        if (key === 'select' || key === 'idx') return; // không cho chỉnh 2 cột đầu
        setColumnKeys(keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]);
    }
    const dataColumnsOnly = DEFAULT_COLUMNS.filter(c => !c.fixed);

    return (
        <div className="h-full flex flex-col gap-3">
            {/* Thanh công cụ: filter + nút */}
            <form onSubmit={onSubmitFilter} className="rounded-[6px] border p-3 flex flex-wrap items-center gap-2 bg-white" style={{ borderColor: 'var(--border)' }}>
                <Select name="scope" defaultValue={params.scope}>
                    <option value="mine">Của tôi</option>
                    <option value="all">Tất cả</option>
                </Select>

                <Input name="q" defaultValue={params.q} placeholder="Tìm tên/SĐT/email..." className="w-56" />

                {/* Select đẹp cho Status */}
                <Select name="status" defaultValue={params.status} className="w-56">
                    <option value="">— Trạng thái —</option>
                    {PIPELINE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>

                {/* Phase */}
                <Select name="phase" defaultValue={params.phase} className="w-44">
                    <option value="">— Phase —</option>
                    {PHASE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </Select>

                {/* Tag (service id) */}
                <Input name="tag" defaultValue={params.tag} placeholder="Tag/Service Id" className="w-44" />

                <button className="h-9 px-3 rounded-[6px] bg-black text-white text-sm inline-flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Lọc
                </button>

                <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={() => setCreateOpen(true)} className="h-9 px-3 rounded-[6px] bg-blue-600 text-white text-sm inline-flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Thêm khách hàng
                    </button>
                    <button type="button" onClick={() => setColOpen(v => !v)} className="h-9 px-3 rounded-[6px] border text-sm inline-flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Cột hiển thị
                    </button>
                </div>
            </form>

            {/* Bảng: header cố định, body scroll */}
            <div className="flex-1 min-h-0 rounded-[6px] border bg-white flex flex-col" style={{ borderColor: 'var(--border)' }}>
                {/* Header */}
                <div className="overflow-hidden">
                    <table className="min-w-full table-fixed">
                        <colgroup>
                            <col className="w-16" />
                            <col className="w-16" />
                            {visibleColumns.filter(c => !c.fixed).map(c => <col key={c.key} />)}
                        </colgroup>
                        <thead className="bg-gray-50 text-xs uppercase">
                            <tr>
                                <th className="px-3 py-2 text-left">
                                    <input
                                        type="checkbox"
                                        className="size-4"
                                        checked={rows.length > 0 && rows.every(r => selected.has(r._id))}
                                        ref={el => { if (el) el.indeterminate = (rows.some(r => selected.has(r._id)) && !rows.every(r => selected.has(r._id))); }}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th className="px-3 py-2 text-left">#</th>
                                {visibleColumns.filter(c => !c.fixed).map(col => (
                                    <th key={col.key} className="px-3 py-2 text-left truncate">{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                    </table>
                </div>

                {/* Body scroll */}
                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="min-w-full table-fixed">
                        <colgroup>
                            <col className="w-16" />
                            <col className="w-16" />
                            {visibleColumns.filter(c => !c.fixed).map(c => <col key={c.key} />)}
                        </colgroup>
                        <tbody className="text-sm">
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-gray-500">
                                        Không có dữ liệu
                                    </td>
                                </tr>
                            )}

                            {rows.map((r, i) => {
                                const rowIdx = (meta.page - 1) * meta.pageSize + i + 1;
                                return (
                                    <tr key={r._id} className="border-t hover:bg-gray-50" style={{ borderColor: 'var(--border)' }}>
                                        {/* checkbox */}
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                className="size-4"
                                                checked={selected.has(r._id)}
                                                onChange={() => toggleOne(r._id)}
                                            />
                                        </td>

                                        {/* stt */}
                                        <td className="px-3 py-2">{rowIdx}</td>

                                        {/* data columns (bị giới hạn bởi visibleColumns) */}
                                        {visibleColumns.filter(c => !c.fixed).map(col => {
                                            const key = col.key;
                                            let content = '—';
                                            if (key === 'name') content = r.name || '—';
                                            else if (key === 'phone') content = r.phone || '—';
                                            else if (key === 'source') content = r.source?.name || '—';
                                            else if (key === 'zaloname') content = r.zaloname || '—';
                                            else if (key === 'zaloPhase') content = r.zaloPhase || '—';
                                            else if (key === 'pipelineStatus') content = Array.isArray(r.pipelineStatus) ? r.pipelineStatus.join(', ') : (r.pipelineStatus || '—');
                                            else if (key === 'careCount') content = (typeof r.careCount === 'number' ? r.careCount : (Array.isArray(r.care) ? r.care.length : 0));
                                            else if (key === 'lastCareAt') content = fmtDate(r.lastCareAt);
                                            else if (key === 'revenue') content = money(r?.serviceDetails?.revenue);

                                            return (
                                                <td
                                                    key={key}
                                                    title={typeof content === 'string' ? content : ''}
                                                    className="px-3 py-2 truncate cursor-pointer"
                                                    onClick={() => setCareOpen(true) || setCareCustomer(r)}
                                                >
                                                    {content}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer: phân trang */}
                <div className="border-t px-3 py-2 flex flex-wrap items-center gap-2 justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm text-gray-600">
                        Tổng: <b>{meta.total}</b> | Đã chọn: <b>{selected.size}</b>
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="h-9 px-2 rounded-[6px] border" onClick={() => goPage(1)} disabled={meta.page <= 1}><ChevronsLeft className="w-4 h-4" /></button>
                        <button className="h-9 px-2 rounded-[6px] border" onClick={() => goPage(meta.page - 1)} disabled={meta.page <= 1}><ChevronLeft className="w-4 h-4" /></button>
                        <div className="px-2 text-sm">Trang <b>{meta.page}</b> / {meta.pages || 1}</div>
                        <button className="h-9 px-2 rounded-[6px] border" onClick={() => goPage(meta.page + 1)} disabled={meta.page >= (meta.pages || 1)}><ChevronRight className="w-4 h-4" /></button>
                        <button className="h-9 px-2 rounded-[6px] border" onClick={() => goPage(meta.pages || 1)} disabled={meta.page >= (meta.pages || 1)}><ChevronsRight className="w-4 h-4" /></button>

                        <div className="ml-2 h-9 flex items-center gap-2">
                            <span className="text-sm text-gray-600">Hiển thị:</span>
                            <Select value={params.size} onChange={e => changeSize(Number(e.target.value))}>
                                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}/trang</option>)}
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Picker cột (bảng toggle) */}
            {colOpen && (
                <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setColOpen(false)}>
                    <div className="absolute right-4 top-4 w-72 rounded-[6px] bg-white shadow-xl ring-1 ring-black/5 p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center mb-2">
                            <div className="font-medium text-sm">Cột hiển thị</div>
                            <button className="ml-auto p-1 rounded hover:bg-black/5" onClick={() => setColOpen(false)}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm opacity-60">
                                <input type="checkbox" checked readOnly /> <span>Chọn (cố định)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm opacity-60">
                                <input type="checkbox" checked readOnly /> <span># (cố định)</span>
                            </div>
                            {dataColumnsOnly.map(c => {
                                const checked = columnKeys.includes(c.key);
                                return (
                                    <label key={c.key} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={checked} onChange={() => toggleCol(c.key)} />
                                        <span>{c.label}</span>
                                    </label>
                                );
                            })}
                            <div className="text-xs text-gray-500 pt-1">
                                Mẹo: Màn hình rộng đến đâu sẽ tự giới hạn số cột (≥2000px tối đa 6 cột dữ liệu).
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CustomerCareModal
                open={careOpen}
                onClose={() => setCareOpen(false)}
                customer={careCustomer}
            />
            <CustomerCreateModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={() => {
                    // refresh trang hiện tại để server trả data mới
                    router.refresh();
                }}
                services={service || []}
            />
        </div>
    );
}
