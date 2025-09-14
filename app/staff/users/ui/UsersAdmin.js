// /app/admin/users/ui/UsersAdmin.jsx
"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket-client';
import * as A from '../users_actions';

export default function UsersAdmin({ initialUsers = [], roles = [] }) {
    const [items, setItems] = useState(initialUsers);
    const socket = useMemo(() => getSocket(), []);
    const formRef = useRef(null);

    useEffect(() => { setItems(initialUsers); }, [initialUsers]);

    useEffect(() => {
        if (!socket) return;
        const room = 'room:users';
        socket.emit('join', room);

        const onMsg = ({ type, doc }) => {
            if (!doc) return;
            if (type === 'delete') {
                setItems(prev => prev.filter(x => String(x._id) !== String(doc._id)));
            } else {
                // insert/update: đưa lên đầu
                setItems(prev => {
                    const id = String(doc._id);
                    const next = prev.filter(x => String(x._id) !== id);
                    return [doc, ...next];
                });
            }
        };

        socket.on('rt:message', onMsg);
        return () => { socket.emit('leave', room); socket.off('rt:message', onMsg); };
    }, [socket]);

    async function onCreate(formData) {
        const r = await A.createUser(formData);
        if (!r?.ok) alert(r?.error || 'Failed');
        else formRef.current?.reset();
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Create */}
            <form ref={formRef} action={onCreate} className="border rounded p-3 space-y-2">
                <div className="font-medium">Thêm nhân sự</div>
                <input name="name" placeholder="Họ tên" className="input" required />
                <input name="email" placeholder="Email" type="email" className="input" required />
                <input name="password" placeholder="Mật khẩu" type="password" className="input" required />
                <select name="roleId" className="input">
                    <option value="">(Mặc định: role đầu tiên)</option>
                    {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
                <button className="btn btn-primary" type="submit">Tạo</button>
            </form>

            {/* List */}
            <div className="border rounded">
                <table className="w-full text-sm">
                    <thead><tr className="bg-neutral-50">
                        <th className="p-2 text-left">Tên</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Trạng thái</th>
                        <th className="p-2">Hành động</th>
                    </tr></thead>
                    <tbody>
                        {items.map(u => (
                            <tr key={u._id} className="border-t">
                                <td className="p-2">{u.name}</td>
                                <td className="p-2">{u.email}</td>
                                <td className="p-2">{u.roleName || <em>none</em>}</td>
                                <td className="p-2">{u.status}</td>
                                <td className="p-2 space-x-2">
                                    <UserRowActions u={u} roles={roles} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function UserRowActions({ u, roles }) {
    async function onUpdate(e) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const r = await A.updateUser(fd);
        if (!r?.ok) alert(r?.error || 'Failed');
    }
    async function onDelete() {
        if (!confirm('Xoá nhân sự này?')) return;
        const r = await A.deleteUser(u._id);
        if (!r?.ok) alert(r?.error || 'Failed');
    }
    return (
        <form onSubmit={onUpdate} className="inline-flex items-center gap-2">
            <input type="hidden" name="id" defaultValue={u._id} />
            <select name="status" defaultValue={u.status} className="input">
                {['active', 'pending', 'suspended', 'deactivated'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="roleId" defaultValue={u.roleId || ''} className="input">
                <option value="">(Không đổi)</option>
                {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
            <button className="btn btn-outline" type="submit">Lưu</button>
            <button className="btn btn-danger" type="button" onClick={onDelete}>Xoá</button>
        </form>
    );
}
