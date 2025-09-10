// /app/zalo/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSocket } from "../../lib/socket-client";
import { MessageCircle, Power, QrCode, RefreshCw, Search, User } from "lucide-react";

function QrModal({ open, onClose, qrImage, title }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
                <div className="px-5 py-4 border-b flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-blue-600" />
                    <div className="font-semibold">{title || "Quét mã QR để đăng nhập"}</div>
                    <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:bg-gray-50">✕</button>
                </div>
                <div className="px-5 py-6 text-center">
                    {qrImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrImage} alt="Zalo QR" className="mx-auto h-56 w-56 rounded-xl object-contain ring-1 ring-gray-200" />
                    ) : (
                        <div className="text-gray-500 text-sm">Đang tạo QR…</div>
                    )}
                </div>
            </div>
        </div>
    );
}

const REST = {
    async sessions() {
        const res = await fetch("/zalo/sessions", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        return j?.data || [];
    }
};

// helper: merge + guard
function mergeSessions(prev, nextList) {
    if (!Array.isArray(nextList) || nextList.length === 0) return prev;
    const map = new Map(prev.map(x => [x.id, x]));
    for (const a of nextList) {
        const old = map.get(a.id) || {};
        map.set(a.id, { ...old, ...a });
    }
    return [...map.values()];
}

export default function ZaloAccountsPage() {
    const socket = useMemo(() => getSocket(), []);
    const mounted = useRef(false);
    const [accounts, setAccounts] = useState([]);
    const [unreads, setUnreads] = useState({});
    const [query, setQuery] = useState("");
    const [qrOpen, setQrOpen] = useState(false);
    const [qrImage, setQrImage] = useState(null);
    const [qrForId, setQrForId] = useState(null);

    useEffect(() => {
        mounted.current = true;

        const seed = async () => {
            const list = await REST.sessions();
            if (!mounted.current) return;
            setAccounts(prev => mergeSessions(prev, list));
            socket?.emit("zalo:unread:all");
        };
        seed();

        const onConnect = () => { socket.emit("zalo:unread:all"); }; // socket sẽ tự push sessions
        const onVisible = async () => {
            if (document.visibilityState === "visible") {
                const list = await REST.sessions();
                if (!mounted.current) return;
                setAccounts(prev => mergeSessions(prev, list));
                socket.emit("zalo:unread:all");
            }
        };
        document.addEventListener("visibilitychange", onVisible);

        // socket events
        const onSessions = (data) => {
            if (Array.isArray(data) && data.length > 0) setAccounts(prev => mergeSessions(prev, data));
        };
        const onOnline = ({ id, displayName, avatar, lastLoginAt }) => {
            setAccounts(prev => {
                const map = new Map(prev.map(x => [x.id, x]));
                const old = map.get(id) || { id };
                map.set(id, { ...old, id, status: 'online', displayName: displayName ?? old.displayName, avatar: avatar ?? old.avatar, lastLoginAt: lastLoginAt || old.lastLoginAt });
                return [...map.values()];
            });
            socket.emit("zalo:unread:account", { id });
            if (qrForId === id) { setQrOpen(false); setQrImage(null); setQrForId(null); }
        };
        const onMerged = ({ from, to }) => {
            // đóng QR nếu đang mở cho from-id
            if (qrForId === from) { setQrOpen(false); setQrImage(null); setQrForId(null); }
            // refresh list
            REST.sessions().then(list => mounted.current && setAccounts(prev => mergeSessions(prev, list)));
            socket.emit("zalo:unread:all");
        };
        const onOffline = ({ id }) => setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, status: 'offline' } : acc));
        const onQR = (payload) => { if (qrOpen) setQrImage(payload?.image || null); };
        const onQrCreated = ({ id }) => { setQrForId(id); setQrOpen(true); setQrImage(null); };
        const onUnreadAll = ({ totals }) => setUnreads(totals || {});
        const onUnreadAccount = ({ id, total }) => setUnreads(u => ({ ...u, [id]: total || 0 }));
        const onProxySet = ({ id, proxy }) => setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, proxy: proxy || null } : acc));

        socket?.on("connect", onConnect);
        socket?.on("zalo:sessions", onSessions);
        socket?.on("zalo:online", onOnline);
        socket?.on("zalo:merged", onMerged);
        socket?.on("zalo:offline", onOffline);
        socket?.on("zalo:qr", onQR);
        socket?.on("zalo:qr:created", onQrCreated);
        socket?.on("zalo:unread:all:ok", onUnreadAll);
        socket?.on("zalo:unread:account:ok", onUnreadAccount);
        socket?.on("zalo:proxy:set", onProxySet);

        // (tùy chọn) thăm dò định kỳ, đã có guard nên không wipe
        const iv = setInterval(async () => {
            const list = await REST.sessions().catch(() => null);
            if (list) setAccounts(prev => mergeSessions(prev, list));
        }, 15000);

        return () => {
            mounted.current = false;
            clearInterval(iv);
            document.removeEventListener("visibilitychange", onVisible);
            socket?.off("connect", onConnect);
            socket?.off("zalo:sessions", onSessions);
            socket?.off("zalo:online", onOnline);
            socket?.off("zalo:merged", onMerged);
            socket?.off("zalo:offline", onOffline);
            socket?.off("zalo:qr", onQR);
            socket?.off("zalo:qr:created", onQrCreated);
            socket?.off("zalo:unread:all:ok", onUnreadAll);
            socket?.off("zalo:unread:account:ok", onUnreadAccount);
            socket?.off("zalo:proxy:set", onProxySet);
        };
    }, [socket, qrOpen, qrForId]);

    const filteredAccounts = accounts.filter(acc => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (acc.displayName || '').toLowerCase().includes(q) || (acc.phone || '').includes(q) || String(acc.id || '').includes(q);
    });

    const openNewQR = () => { setQrForId(null); setQrOpen(true); setQrImage(null); getSocket()?.emit("zalo:login:qr"); };
    const loginAgain = (id) => { setQrForId(id); setQrOpen(true); setQrImage(null); getSocket()?.emit("zalo:login:qr", id); };
    const logout = (id) => { getSocket()?.emit("zalo:logout", id); };
    const refreshList = async () => { const list = await REST.sessions(); setAccounts(prev => mergeSessions(prev, list)); socket?.emit("zalo:unread:all"); };

    return (
        <div className="mx-auto max-w-6xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <MessageCircle className="w-6 h-6 text-blue-700" />
                    <h1 className="text-2xl font-semibold">Tài khoản Zalo</h1>
                    <span className="ml-2 text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-1">
                        Tổng unread: {Object.values(unreads).reduce((a, b) => a + (b || 0), 0)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
                        <Search className="w-4 h-4 text-gray-500" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tên / số / id..." className="w-64 outline-none text-sm" />
                    </div>
                    <button onClick={refreshList} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Làm mới</button>
                    <Link href="/proxy" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50">Quản lý Proxy</Link>
                    <button onClick={openNewQR} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                        <QrCode className="w-5 h-5" /> Thêm tài khoản
                    </button>
                </div>
            </div>

            <div className="grid gap-3">
                {filteredAccounts.map(acc => {
                    const unread = unreads[acc.id] || 0;
                    const online = acc.status === "online";
                    return (
                        <div key={acc.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={acc.avatar || "/default-avatar.png"} alt={acc.displayName || acc.id} className="h-12 w-12 rounded-full object-cover ring-1 ring-gray-200" />
                                <div>
                                    <div className="font-medium flex items-center gap-2">
                                        {acc.displayName || "(Không tên)"} <span className="text-xs text-gray-400">#{acc.id}</span>
                                        {acc.phone ? <span className="text-[11px] text-gray-500 inline-flex items-center gap-1"><User className="w-3 h-3" /> {acc.phone}</span> : null}
                                        {unread > 0 && <span className="ml-1 text-[11px] rounded-full bg-red-600 text-white px-2 py-0.5">{unread} chưa đọc</span>}
                                    </div>
                                    <div className={online ? "text-xs text-green-600" : "text-xs text-gray-500"}>
                                        {online ? "Online" : "Offline"}
                                        {acc.lastLoginAt ? <span className="ml-2 text-gray-400">(đăng nhập: {new Date(acc.lastLoginAt).toLocaleString()})</span> : null}
                                    </div>
                                    <div className="text-[11px] mt-0.5">
                                        {acc.proxy ? <span className="text-blue-700">Proxy: {acc.proxy}</span> : <span className="text-gray-400">Chưa gán proxy</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href={`/zalo/${acc.id}`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50">Mở chat</Link>
                                {online ? (
                                    <button onClick={() => logout(acc.id)} className="inline-flex items-center gap-2 rounded-xl text-red-600 px-3 py-2 hover:bg-red-50"><Power className="w-4 h-4" /> Đăng xuất</button>
                                ) : (
                                    <button onClick={() => loginAgain(acc.id)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"><QrCode className="w-4 h-4" /> Đăng nhập lại</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredAccounts.length === 0 && <div className="mt-10 text-center text-sm text-gray-500">Không có tài khoản phù hợp bộ lọc.</div>}

            <QrModal open={qrOpen} onClose={() => { setQrOpen(false); setQrImage(null); setQrForId(null); }} qrImage={qrImage} title={qrForId ? `Đăng nhập lại #${qrForId}` : 'Thêm tài khoản'} />
        </div>
    );
}
