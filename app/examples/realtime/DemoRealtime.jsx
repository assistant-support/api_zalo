"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket-client';
import { formatAtTZ } from '@/functions/client';

function uniqPushTop(list, doc) {
    const id = String(doc._id || '');
    if (!id) return [doc, ...list];
    if (list.some(x => String(x._id) === id)) return list;
    return [doc, ...list];
}

export default function DemoRealtime({ room = 'demo', createAction, initial = [] }) {
    const [items, setItems] = useState(initial);
    const formRef = useRef(null);
    const socket = useMemo(() => getSocket(), []);

    // nếu initial đổi (đi room khác), đồng bộ lại
    useEffect(() => { setItems(initial); }, [initial]);

    useEffect(() => {
        if (!socket) return;

        const roomName = `room:${room}`;
        socket.emit('join', roomName);

        // nhận sự kiện realtime mỗi khi có ghi DB (insert/update…) → server emit 'rt:message'
        const onMessage = (payload) => {
            // payload: { type: 'insert' | 'update' | 'delete', doc }
            if (!payload?.doc) return;
            setItems(prev => uniqPushTop(prev, payload.doc));
        };

        // (tuỳ chọn) nếu bạn bật snapshot khi join ở server, nhận 'rt:snapshot' để đồng bộ lại
        const onSnapshot = (docs) => {
            if (!Array.isArray(docs)) return;
            // hợp nhất snapshot vào state hiện tại, tránh trùng
            setItems(prev => {
                const seen = new Set(prev.map(x => String(x._id)));
                const merged = [...prev];
                for (const d of docs) {
                    const id = String(d._id || '');
                    if (!seen.has(id)) { merged.push(d); seen.add(id); }
                }
                // sắp xếp mới → cũ theo ts
                merged.sort((a, b) => (new Date(b.ts) - new Date(a.ts)));
                return merged.slice(0, 100);
            });
        };

        socket.on('rt:message', onMessage);
        socket.on('rt:snapshot', onSnapshot);

        // khi rời trang/room
        return () => {
            socket.emit('leave', roomName);
            socket.off('rt:message', onMessage);
            socket.off('rt:snapshot', onSnapshot);
        };
    }, [socket, room]);

    // gửi form → server action (insert + emit socket)
    const onSubmit = async (formData) => {
        formData.set('room', room);
        await createAction(formData);
        formRef.current?.reset();
    };

    return (
        <div className="space-y-4">
            <form ref={formRef} action={onSubmit} className="flex gap-2">
                <input name="text" className="border px-2 rounded flex-1" placeholder="Nhập tin nhắn..." />
                <button type="submit" className="px-3 py-1 border rounded">Gửi</button>
            </form>

            <ul className="space-y-2">
                {items.map((m) => (
                    <li key={String(m._id)} className="border rounded p-2">
                        <div className="text-xs text-neutral-500">
                            {formatAtTZ(m.ts)} — room: {m.room}
                        </div>
                        <div>{m.text}</div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
