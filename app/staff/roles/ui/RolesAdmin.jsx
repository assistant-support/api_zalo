// /app/admin/roles/ui/RolesAdmin.jsx
"use client";

import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '@/lib/socket-client';
import * as A from '../roles_actions';
import Popup from '@/components/ui/popup';
import { Plus, Shield, Search, Tag, X, Trash2 } from "lucide-react";

const ACTION_RE = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/;

export default function RolesAdmin({ initialRoles = [], initialPerms = [], capabilities = {} }) {
    const socket = useMemo(() => getSocket(), []);
    const [roles, setRoles] = useState(initialRoles);
    const [perms, setPerms] = useState(initialPerms);
    const [roleId, setRoleId] = useState(initialRoles[0]?._id ?? '');

    const can = (k) => !!capabilities?.[k];

    /* ===================== Realtime ===================== */
    useEffect(() => {
        if (!socket) return;
        socket.emit('join', 'room:roles');
        const onMsg = ({ type, doc }) => {
            if (!doc || doc.kind !== 'role') return;
            setRoles((prev) => {
                const id = String(doc._id);
                if (type === 'delete') return prev.filter((r) => String(r._id) !== id);
                const next = prev.filter((r) => String(r._id) !== id);
                return [doc, ...next];
            });
        };
        socket.on('rt:message', onMsg);
        return () => {
            socket.emit('leave', 'room:roles');
            socket.off('rt:message', onMsg);
        };
    }, [socket]);

    useEffect(() => {
        if (!socket || !capabilities?.canListPerm) return;
        socket.emit('join', 'room:permissions');
        const onMsg = ({ type, doc }) => {
            if (!doc || doc.kind !== 'permission') return;
            setPerms((prev) => {
                const id = String(doc._id);
                if (type === 'delete') return prev.filter((p) => String(p._id) !== id);
                const next = prev.filter((p) => String(p._id) !== id);
                return [doc, ...next];
            });
        };
        socket.on('rt:message', onMsg);
        return () => {
            socket.emit('leave', 'room:permissions');
            socket.off('rt:message', onMsg);
        };
    }, [socket, capabilities?.canListPerm]);

    const selectedRole = roles.find((r) => String(r._id) === String(roleId));

    /* ===================== Popups ===================== */
    const [showCreateRole, setShowCreateRole] = useState(false);
    const [showCreatePerm, setShowCreatePerm] = useState(false);

    // Create Role
    const [rName, setRName] = useState('');
    const [rDesc, setRDesc] = useState('');
    const [rImmu, setRImmu] = useState(false);

    async function submitCreateRole() {
        if (!can('canCreateRole')) return;
        const fd = new FormData();
        fd.set('name', rName.trim());
        fd.set('description', rDesc.trim());
        if (rImmu) fd.set('isImmutable', '1');
        const res = await A.createRole(fd);
        if (!res?.ok) return alert(res?.error || 'Tạo role thất bại');
        setRName(''); setRDesc(''); setRImmu(false);
        setShowCreateRole(false);
    }

    // Create Permission (ensure + optional attach)
    const [pAction, setPAction] = useState('');
    const [pGroup, setPGroup] = useState('');
    const [pLabel, setPLabel] = useState('');
    const [pDesc, setPDesc] = useState('');
    const [pTags, setPTags] = useState('');
    const [pAttachNow, setPAttachNow] = useState(true);

    const actionIsValid = ACTION_RE.test(pAction);
    const groupIsValid = !!pGroup.trim();
    const descIsValid = !!pDesc.trim();

    async function submitCreatePermission() {
        if (!can('canCreatePerm')) return;
        if (!actionIsValid || !groupIsValid || !descIsValid) {
            alert('Nhập đúng quy ước (module:verb), group/description bắt buộc.');
            return;
        }
        const res = await A.grantPermissionToRole({
            roleId: pAttachNow && can('canGrant') ? roleId : undefined,
            action: pAction.trim(),
            group: pGroup.trim(),
            description: pDesc.trim(),
            label: pLabel.trim() || pAction.trim(),
            tags: pTags.trim(),
            conditions: {},
            allowedFields: ['*'],
        });
        if (!res?.ok) return alert(res?.error || 'Tạo/Gán chức năng thất bại');
        setPAction(''); setPGroup(''); setPLabel(''); setPDesc(''); setPTags(''); setPAttachNow(true);
        setShowCreatePerm(false);
    }

    /* ===================== Permission Picker ===================== */
    const [q, setQ] = useState('');
    const [tag, setTag] = useState('');
    const [group, setGroup] = useState('');
    const [checked, setChecked] = useState(() => new Set());

    const allTags = useMemo(() => {
        const s = new Set();
        (perms || []).forEach((p) => (p.tags || []).forEach((t) => s.add(t)));
        return Array.from(s).sort();
    }, [perms]);

    const allGroups = useMemo(() => {
        const s = new Set();
        (perms || []).forEach((p) => p.group && s.add(p.group));
        return Array.from(s).sort();
    }, [perms]);

    const filtered = (capabilities?.canListPerm ? perms : []).filter((p) => {
        const hitQ =
            !q ||
            p.action?.toLowerCase().includes(q.toLowerCase()) ||
            p.label?.toLowerCase().includes(q.toLowerCase()) ||
            p.description?.toLowerCase().includes(q.toLowerCase());
        const hitTag = !tag || (p.tags || []).includes(tag);
        const hitGroup = !group || p.group === group;
        return hitQ && hitTag && hitGroup;
    });

    function toggle(id) {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }
    const clearSel = () => setChecked(new Set());

    async function attachBulk() {
        if (!can('canGrant') || !checked.size) return;
        const ids = Array.from(checked);
        const r = await A.attachPermissionsBulk(roleId, ids, { allowedFields: ['*'], conditions: {} });
        if (!r?.ok) alert(r?.error || 'Gán thất bại');
        clearSel();
    }

    /* ===================== Render ===================== */
    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="avatar-sq">RB</span>
                    <div>
                        <div className="font-medium">Roles & Permissions</div>
                        <div className="text-xs text-muted">Quản lý quyền theo nhóm chức năng (ABAC + field-level)</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="icon-btn" title="Tạo Role" onClick={() => setShowCreateRole(true)} disabled={!can('canCreateRole')}>
                        <Shield size={18} />
                    </button>
                    <button className="icon-btn" title="Tạo Chức năng" onClick={() => setShowCreatePerm(true)} disabled={!can('canCreatePerm')}>
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                {/* A) Role + danh sách chức năng đã gán */}
                <section className="card elev-1 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-medium">Role</h2>
                        {!roles.length && <span className="text-xs text-muted">Chưa có role — hãy tạo mới</span>}
                    </div>

                    <div className="flex items-center gap-2">
                        <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                            {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                        </select>
                        {selectedRole?.isImmutable && (
                            <span className="text-xs px-2 py-1 rounded bg-[var(--warning-50)] text-[var(--warning-600)]">immutable</span>
                        )}
                    </div>

                    <p className="text-sm text-muted mt-2">{selectedRole?.description}</p>

                    <div className="mt-3">
                        <h3 className="font-medium">Chức năng đã gán</h3>
                        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                            {(selectedRole?.permissionsExpanded || []).map((p) => (
                                <li key={p._id || p.action} className="py-2 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">
                                            {p.label}{' '}<span className="text-xs text-muted">({p.action})</span>
                                        </div>
                                        <div className="text-xs text-muted">{p.group} • {(p.tags || []).join(', ')}</div>
                                    </div>
                                    <button
                                        className="icon-btn"
                                        onClick={async () => {
                                            if (!can('canGrant')) return;
                                            if (!confirm('Gỡ chức năng này khỏi role?')) return;
                                            const r = await A.detachPermission(roleId, p._id);
                                            if (!r?.ok) alert(r?.error || 'Failed');
                                        }}
                                        disabled={selectedRole?.isImmutable || !can('canGrant')}
                                        title={!can('canGrant') ? 'Bạn không có quyền role:grant' : selectedRole?.isImmutable ? 'Role immutable – không thể sửa' : 'Gỡ'}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </li>
                            ))}
                            {!selectedRole?.permissionsExpanded?.length && (
                                <li className="py-4 text-center text-muted text-sm">Role này chưa có chức năng nào</li>
                            )}
                        </ul>
                    </div>
                </section>

                {/* B) Permission Picker */}
                <section className="card elev-1 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-medium">Chức năng (chọn để gán)</h2>
                        {!capabilities?.canListPerm && (
                            <span className="text-xs text-[var(--danger-700)]">Bạn không có quyền permission:list</span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2 top-2.5" size={16} />
                            <input className="input pl-8" placeholder="Tìm theo tên/label/mô tả" value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="input max-w-[160px]" value={group} onChange={(e) => setGroup(e.target.value)}>
                            <option value="">-- group --</option>
                            {allGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                            <Tag size={16} />
                            <select className="input max-w-[160px]" value={tag} onChange={(e) => setTag(e.target.value)}>
                                <option value="">-- tag --</option>
                                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="border rounded mt-3 max-h-[360px] overflow-auto" style={{ borderColor: 'var(--border)' }}>
                        <table className="w-full text-sm">
                            <thead className="bg-surface-2">
                                <tr>
                                    <th className="p-2 w-10"></th>
                                    <th className="p-2 text-left">Chức năng</th>
                                    <th className="p-2">Nhóm</th>
                                    <th className="p-2">Tags</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p) => {
                                    const id = String(p._id);
                                    return (
                                        <tr key={id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                                            <td className="p-2">
                                                <input type="checkbox" checked={checked.has(id)} onChange={() => toggle(id)} disabled={!can('canGrant')} />
                                            </td>
                                            <td className="p-2">
                                                <div className="font-medium">{p.label || p.action}</div>
                                                <div className="text-xs text-muted">{p.action} — {p.description}</div>
                                            </td>
                                            <td className="p-2 text-center">{p.group}</td>
                                            <td className="p-2 text-xs text-muted">{(p.tags || []).join(', ')}</td>
                                        </tr>
                                    );
                                })}
                                {!filtered.length && (
                                    <tr><td className="p-3 text-center text-muted" colSpan={4}>Không có chức năng phù hợp bộ lọc</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                        <button className="btn btn-primary" onClick={attachBulk} disabled={!checked.size || !can('canGrant')} title={!can('canGrant') ? 'Bạn không có quyền role:grant' : 'Gán'}>
                            Gán {checked.size ? `(${checked.size})` : ''}
                        </button>
                        <button className="btn btn-outline" onClick={clearSel} disabled={!checked.size}>Bỏ chọn</button>
                    </div>
                </section>
            </div>

            {/* Popup: Create Role */}
            <Popup
                open={showCreateRole}
                onClose={() => setShowCreateRole(false)}
                header="Tạo Role"
                footer={
                    <>
                        <button className="btn btn-outline" onClick={() => setShowCreateRole(false)}><X size={16} /> Hủy</button>
                        <button className="btn btn-primary" onClick={submitCreateRole} disabled={!rName.trim() || !can('canCreateRole')}>Tạo</button>
                    </>
                }
            >
                {!can('canCreateRole') && <p className="text-sm text-[var(--danger-700)] mb-2">Bạn không có quyền role:create</p>}
                <div className="space-y-2">
                    <div>
                        <label className="text-xs block mb-1">Tên Role *</label>
                        <input className="input" value={rName} onChange={(e) => setRName(e.target.value)} placeholder="vd: manager" />
                    </div>
                    <div>
                        <label className="text-xs block mb-1">Mô tả</label>
                        <textarea className="input" rows={3} value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={rImmu} onChange={(e) => setRImmu(e.target.checked)} />
                        <span>Immutable (không cho sửa/xoá)</span>
                    </label>
                </div>
            </Popup>

            {/* Popup: Create Permission (ensure + optional attach) */}
            <Popup
                open={showCreatePerm}
                onClose={() => setShowCreatePerm(false)}
                header="Tạo Chức năng"
                footer={
                    <>
                        <button className="btn btn-outline" onClick={() => setShowCreatePerm(false)}><X size={16} /> Hủy</button>
                        <button
                            className="btn btn-primary"
                            onClick={submitCreatePermission}
                            disabled={!actionIsValid || !groupIsValid || !descIsValid || !can('canCreatePerm')}
                        >
                            <Plus size={16} /> Tạo
                        </button>
                    </>
                }
            >
                {!can('canCreatePerm') && <p className="text-sm text-[var(--danger-700)] mb-2">Bạn không có quyền permission:create</p>}
                <ul className="text-xs text-muted list-disc ml-5 mb-3 space-y-1">
                    <li><b>Action</b> dạng <code>module:verb</code> (vd: <code>user:update</code>), chỉ lowercase, số, <code>-</code>, <code>_</code>.</li>
                    <li><b>Group</b> = module hiển thị (vd: <code>Users</code>, <code>Invoices</code>)</li>
                    <li>Backend nhớ bọc <code>withPermAction('module:verb')</code>.</li>
                </ul>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="md:col-span-2">
                        <label className="text-xs block mb-1">Action *</label>
                        <input className="input" placeholder="vd: invoice:create" value={pAction} onChange={(e) => setPAction(e.target.value)} />
                        {!!pAction && (actionIsValid
                            ? <div className="text-xs text-[var(--success-600)] mt-1">Hợp lệ</div>
                            : <div className="text-xs text-[var(--danger-700)] mt-1">Không hợp lệ</div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs block mb-1">Group *</label>
                        <input className="input" placeholder="vd: Invoices" value={pGroup} onChange={(e) => setPGroup(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs block mb-1">Label</label>
                        <input className="input" placeholder="Nếu bỏ trống sẽ = action" value={pLabel} onChange={(e) => setPLabel(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs block mb-1">Description *</label>
                        <textarea className="input" rows={3} value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs block mb-1">Tags (a,b,c)</label>
                        <input className="input" value={pTags} onChange={(e) => setPTags(e.target.value)} />
                    </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={pAttachNow} onChange={(e) => setPAttachNow(e.target.checked)} disabled={!can('canGrant')} />
                        <span> Gán ngay vào role đang chọn {!can('canGrant') ? ' (cần quyền role:grant)' : ''}</span>
                    </label>
                    <div className="text-xs text-muted">
                        Role hiện tại:&nbsp;<b>{roles.find(r => String(r._id) === String(roleId))?.name || '—'}</b>
                    </div>
                </div>
            </Popup>
        </div>
    );
}
