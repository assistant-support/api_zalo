// /app/proxy/page.jsx
"use client";
import { useEffect, useState } from "react";
import { getSocket } from "#lib/socket-client";
import { Shield, Plus, RefreshCcw, CheckCircle2, XCircle, Link as LinkIcon } from "lucide-react";

const REST = {
    async list() {
        const r = await fetch('/proxy/list', { cache: 'no-store' });
        return (await r.json()).data ? (await r.json()).data : (await r.json());
    },
    async getList() {
        const r = await fetch('/proxy/list', { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        return { proxies: j?.proxies || [], accounts: j?.accounts || [] };
    },
    async create(url, label) {
        const r = await fetch('/proxy/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, label }) });
        return await r.json();
    },
    async test(url) {
        const r = await fetch('/proxy/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
        return await r.json();
    },
    async assign(accountId, proxy) {
        const r = await fetch(`/zalo/${accountId}/proxy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proxy }) });
        return await r.json();
    },
    async del(id) {
        const r = await fetch(`/proxy/${id}`, { method: 'DELETE' });
        return await r.json();
    }
};

export default function ProxyPage() {
    const socket = getSocket();
    const [proxies, setProxies] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [url, setUrl] = useState('');
    const [label, setLabel] = useState('');
    const [testing, setTesting] = useState({}); // {url: {loading, result}}

    const load = async () => {
        const { proxies, accounts } = await REST.getList();
        setProxies(proxies); setAccounts(accounts);
    };

    useEffect(() => {
        load();
        const onProxySet = ({ id, proxy }) => setAccounts(prev => prev.map(a => a.id === id ? { ...a, proxy } : a));
        socket?.on('zalo:proxy:set', onProxySet);
        return () => socket?.off('zalo:proxy:set', onProxySet);
    }, []);

    const create = async () => {
        if (!url.trim()) return;
        await REST.create(url.trim(), label.trim());
        setUrl(''); setLabel('');
        await load();
    };
    const test = async (u) => {
        setTesting(t => ({ ...t, [u]: { loading: true } }));
        const r = await REST.test(u);
        setTesting(t => ({ ...t, [u]: { loading: false, result: r?.data || r } }));
    };
    const assign = async (accId, proxy) => {
        await REST.assign(accId, proxy || null);
        // server sẽ emit zalo:proxy:set, state sẽ cập nhật
    };
    const del = async (id) => {
        await REST.del(id); await load();
    };

    // map accounts using each proxy
    const usedMap = new Map();
    for (const a of accounts) {
        if (!a.proxy) continue;
        usedMap.set(a.proxy, [...(usedMap.get(a.proxy) || []), a]);
    }

    return (
        <div className="mx-auto max-w-5xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-emerald-700" />
                <h1 className="text-2xl font-semibold">Quản lý Proxy</h1>
                <button onClick={load} className="ml-auto inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50">
                    <RefreshCcw className="w-4 h-4" /> Làm mới
                </button>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 mb-6">
                <div className="text-sm font-medium mb-2">Thêm proxy</div>
                <div className="flex gap-2">
                    <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://user:pass@host:port" className="flex-1 rounded-xl border px-3 py-2 outline-none text-sm" />
                    <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ghi chú (tuỳ chọn)" className="w-60 rounded-xl border px-3 py-2 outline-none text-sm" />
                    <button onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"><Plus className="w-4 h-4" /> Thêm</button>
                </div>
            </div>

            <div className="grid gap-3">
                {proxies.map(p => {
                    const using = usedMap.get(p.url) || [];
                    const t = testing[p.url]?.result;
                    const testingNow = testing[p.url]?.loading;
                    const ok = t ? t.ok : (p.status === 'ok');
                    return (
                        <div key={p._id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                            <div className="flex items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-gray-500" />
                                <div className="font-medium">{p.label || '(Không tên)'}</div>
                                <div className="text-xs text-gray-500">{p.url}</div>
                                <div className="ml-auto flex items-center gap-3">
                                    <button onClick={() => test(p.url)} className="text-sm rounded-xl border px-3 py-1.5 hover:bg-gray-50">{testingNow ? 'Đang test…' : 'Test'}</button>
                                    <button onClick={() => del(p._id)} className="text-sm rounded-xl border px-3 py-1.5 hover:bg-red-50 text-red-600">Xoá</button>
                                </div>
                            </div>
                            <div className="mt-2 text-xs flex items-center gap-2">
                                {ok ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> OK</span>
                                    : <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> Lỗi</span>}
                                {t?.ip && <span className="text-gray-500">IP: {t.ip}</span>}
                                {t?.latencyMs && <span className="text-gray-500">~{t.latencyMs}ms</span>}
                            </div>
                            <div className="mt-3">
                                <div className="text-xs text-gray-500 mb-1">Đang gán cho:</div>
                                <div className="flex flex-wrap gap-2">
                                    {using.length === 0 && <div className="text-xs text-gray-400">Chưa gán tài khoản nào.</div>}
                                    {using.map(a => (
                                        <div key={a.id} className="text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-1">#{a.id} {a.displayName || ''} ({a.phone || 'N/A'})</div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="text-xs text-gray-500 mb-1">Gán nhanh cho tài khoản:</div>
                                <div className="flex flex-wrap gap-2">
                                    {accounts.map(a => (
                                        <button key={a.id}
                                            onClick={() => assign(a.id, p.url)}
                                            className={"text-xs rounded-full px-3 py-1 border " + (a.proxy === p.url ? "bg-emerald-600 border-emerald-600 text-white" : "hover:bg-gray-50")}>
                                            #{a.id} {a.displayName || ''} {a.proxy === p.url ? '✓' : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
