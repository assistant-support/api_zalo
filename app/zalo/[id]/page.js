// // /app/zalo/[id]/page.jsx
// 'use client';
// import { useEffect, useMemo, useRef, useState } from 'react';
// import { useParams } from 'next/navigation';
// import { getSocket } from '../../../lib/socket-client';
// import { Search, Send, Paperclip, Bell, CheckCheck, FileText, Image as ImageIcon, Video, FileAudio, File } from 'lucide-react';

// function cx(...a) { return a.filter(Boolean).join(' '); }

// function AttachmentRow({ a, isSelf }) {
//     const icon = a.type === 'image' ? <ImageIcon className="w-4 h-4" />
//         : (a.mime || '').startsWith('video/') ? <Video className="w-4 h-4" />
//             : (a.mime || '').startsWith('audio/') ? <FileAudio className="w-4 h-4" />
//                 : (a.mime || '').includes('pdf') || (a.mime || '').includes('word') ? <FileText className="w-4 h-4" />
//                     : <File className="w-4 h-4" />;

//     const link = a.downloadLink || a.viewLink || a.url || '#';
//     const isImage = a.type === 'image' && (a.thumbnailLink || a.viewLink || a.url);

//     return (
//         <div className="mt-1 text-xs">
//             {isImage ? (
//                 // eslint-disable-next-line @next/next/no-img-element
//                 <a href={link} target="_blank" className="block group">
//                     <img src={a.thumbnailLink || a.viewLink || a.url} alt={a.name || 'image'} className={cx('rounded-xl max-w-[220px] max-h-[180px] object-cover', isSelf ? 'ring-1 ring-white/40' : 'ring-1 ring-gray-200')} />
//                     <div className={cx('truncate', isSelf ? 'text-blue-100' : 'text-gray-500')}>{a.name || 'Ảnh'}</div>
//                 </a>
//             ) : (
//                 <a href={link} target="_blank" className={cx('inline-flex items-center gap-2 px-2 py-1 rounded-lg border', isSelf ? 'border-white/30 text-blue-100' : 'border-gray-300 text-gray-600')}>
//                     {icon}
//                     <span className="truncate max-w-[220px]">{a.name || 'Tệp đính kèm'}</span>
//                 </a>
//             )}
//         </div>
//     );
// }

// export default function ZaloChatPage() {
//     const { id } = useParams(); // accountId
//     const socket = useMemo(() => getSocket(), []);
//     const [threads, setThreads] = useState([]);
//     const [active, setActive] = useState(null);
//     const [search, setSearch] = useState('');
//     const [history, setHistory] = useState([]);
//     const [buffer, setBuffer] = useState([]);
//     const [text, setText] = useState('');
//     const endRef = useRef(null);

//     const scrollToEnd = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);

//     useEffect(() => {
//         if (!socket) return;

//         if (socket.connected) socket.emit('zalo:threads', { id });

//         const onThreadsOK = ({ id: accId, data }) => { if (accId !== id) return; setThreads(data || []); };
//         const onThreadsUpdate = ({ accountId }) => { if (accountId !== id) return; socket.emit('zalo:threads', { id }); };

//         const onHistoryOK = ({ id: accId, threadId, data }) => {
//             if (accId !== id || threadId !== active) return;
//             setHistory(data || []); setBuffer([]); scrollToEnd();
//             socket.emit('zalo:thread:seen', { id, threadId });
//         };

//         const onMsg = ({ id: accId, data: m }) => {
//             if (accId !== id) return;
//             if (!active || String(m.threadId) !== String(active)) return;
//             setBuffer((prev) => [...prev, m]); scrollToEnd();
//         };

//         const onMsgUpdate = ({ id: accId, threadId, data }) => {
//             if (accId !== id) return;
//             if (!active || String(threadId) !== String(active)) return;
//             setBuffer((prev) => {
//                 const next = prev.map((m) => {
//                     const d = m?.data || {};
//                     if (d.cliMsgId && data.cliMsgId && d.cliMsgId === data.cliMsgId) return { ...m, data: { ...d, ...data } };
//                     if (d.msgId && data.msgId && d.msgId === data.msgId) return { ...m, data: { ...d, ...data } };
//                     return m;
//                 });
//                 return next;
//             });
//         };

//         socket.on('zalo:threads:ok', onThreadsOK);
//         socket.on('zalo:threads:update', onThreadsUpdate);
//         socket.on('zalo:history:ok', onHistoryOK);
//         socket.on('zalo:message', onMsg);
//         socket.on('zalo:message:update', onMsgUpdate);

//         return () => {
//             socket.off('zalo:threads:ok', onThreadsOK);
//             socket.off('zalo:threads:update', onThreadsUpdate);
//             socket.off('zalo:history:ok', onHistoryOK);
//             socket.off('zalo:message', onMsg);
//             socket.off('zalo:message:update', onMsgUpdate);
//         };
//     }, [socket, id, active]);

//     const openThread = (t) => {
//         setActive(t.threadId);
//         socket.emit('zalo:history', { id, threadId: t.threadId, limit: 60 });
//     };

//     const sendText = (e) => {
//         e?.preventDefault?.();
//         if (!text.trim() || !active) return;
//         socket.emit('zalo:send:text', { id, threadId: active, text: text.trim() });
//         setText('');
//     };

//     const sendFile = async (e) => {
//         const file = e.target.files?.[0];
//         if (!file || !active) return;
//         const arr = await file.arrayBuffer();
//         socket.emit('zalo:send:file', { id, threadId: active, filename: file.name, fileBuffer: arr });
//         e.target.value = '';
//     };

//     const msgs = [...history, ...buffer].map((m, idx) => {
//         const d = m?.data || {};
//         const isSelf = !!m.isSelf || !!d.isSelf;
//         const text = typeof d?.content === 'string' ? d.content : (d?.content?.text || '');
//         const hasAttach = Array.isArray(d?.attachments) && d.attachments.length > 0;
//         return {
//             key: d.msgId || d.cliMsgId || idx,
//             isSelf,
//             text,
//             ts: Number(d?.ts || Date.now()),
//             attachments: (d.attachments || []),
//             status: d.status || m?.status || (hasAttach ? 'uploading' : 'delivered'),
//             isSticker: (d?.content?.type === 'sticker') || false
//         };
//     });

//     const listThreads = threads.filter(t => {
//         if (!search.trim()) return true;
//         return (t.name || '').toLowerCase().includes(search.toLowerCase()) || String(t.threadId).includes(search.trim());
//     });

//     return (
//         <div className="h-[calc(100vh-2rem)] m-4 grid grid-cols-12 rounded-2xl overflow-hidden bg-white shadow-xl">
//             {/* Sidebar */}
//             <aside className="col-span-4 border-r border-gray-100 bg-gray-50 flex flex-col">
//                 <div className="p-4 border-b bg-white flex items-center gap-2">
//                     <Bell className="w-5 h-5 text-gray-600" />
//                     <div className="font-semibold">Tin nhắn</div>
//                 </div>

//                 <div className="p-3">
//                     <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
//                         <Search className="w-4 h-4 text-gray-500" />
//                         <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc UID..." className="w-full outline-none text-sm" />
//                     </div>
//                 </div>

//                 <div className="flex-1 overflow-auto px-2 pb-2">
//                     {listThreads.map((t) => (
//                         <button key={t.threadId} onClick={() => openThread(t)}
//                             className={cx('w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-100',
//                                 active === t.threadId ? 'bg-white border-gray-100 shadow-sm' : '')}>
//                             {/* eslint-disable-next-line @next/next/no-img-element */}
//                             <img src={t.avatar || '/default-avatar.png'} alt="" className="w-10 h-10 rounded-full object-cover" />
//                             <div className="flex-1 text-left">
//                                 <div className="text-sm font-medium leading-tight">{t.name || t.threadId}</div>
//                                 <div className="text-[11px] text-gray-500 truncate max-w-[220px]">{t.lastMessageText || '[Tin nhắn]'}</div>
//                             </div>
//                             {t.unread > 0 && (
//                                 <span className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-red-600 text-white text-xs">{t.unread}</span>
//                             )}
//                         </button>
//                     ))}
//                     {listThreads.length === 0 && <div className="text-xs text-gray-400 px-3">Chưa có hội thoại.</div>}
//                 </div>
//             </aside>

//             {/* Main */}
//             <section className="col-span-8 flex flex-col">
//                 <div className="p-4 border-b bg-white flex items-center gap-3">
//                     {active ? (
//                         <>
//                             {/* eslint-disable-next-line @next/next/no-img-element */}
//                             <img src={threads.find(x => x.threadId === active)?.avatar || '/default-avatar.png'} alt="" className="w-9 h-9 rounded-full object-cover" />
//                             <div className="flex-1">
//                                 <div className="font-semibold leading-tight">{threads.find(x => x.threadId === active)?.name || active}</div>
//                                 <div className="text-xs text-gray-500">UID: {active}</div>
//                             </div>
//                         </>
//                     ) : <div className="text-gray-500 text-sm">Chọn cuộc trò chuyện…</div>}
//                 </div>

//                 <div className="flex-1 overflow-auto bg-gray-50 p-4">
//                     {active && msgs.map((m) => (
//                         <div key={m.key} className="mb-2 flex">
//                             <div className={cx('max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm', m.isSelf ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-white')}>
//                                 {!!m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}

//                                 {/* Sticker fallback */}
//                                 {m.isSticker && <div className={cx('italic mt-1', m.isSelf ? 'text-blue-100' : 'text-gray-500')}>(Sticker)</div>}

//                                 {m.attachments?.length > 0 && (
//                                     <div className="mt-1">
//                                         {m.attachments.map((a, i) => (<AttachmentRow key={i} a={a} isSelf={m.isSelf} />))}
//                                     </div>
//                                 )}

//                                 <div className={cx('text-[10px] mt-1 flex items-center gap-2', m.isSelf ? 'text-blue-100' : 'text-gray-400')}>
//                                     {m.status === 'uploading' ? <span className="animate-pulse">Đang xử lý…</span> : <CheckCheck className="w-3 h-3" />}
//                                     {new Date(m.ts).toLocaleString()}
//                                 </div>
//                             </div>
//                         </div>
//                     ))}
//                     {!active && <div className="text-gray-400 text-sm">Chọn một người để bắt đầu trò chuyện.</div>}
//                     <div ref={endRef} />
//                 </div>

//                 <form onSubmit={sendText} className="p-3 border-t bg-white flex items-center gap-2">
//                     <label className={cx('p-2 rounded-xl border hover:bg-gray-50 cursor-pointer', !active && 'opacity-50 pointer-events-none')}>
//                         <input type="file" onChange={sendFile} className="hidden" disabled={!active} />
//                         <Paperclip className="w-5 h-5" />
//                     </label>
//                     <input value={text} onChange={(e) => setText(e.target.value)} placeholder={active ? "Nhập tin nhắn..." : "Chọn người để chat"} className="flex-1 rounded-xl border px-3 py-2 outline-none text-sm" disabled={!active} />
//                     <button className={cx('px-4 py-2 rounded-xl text-white flex items-center gap-2', text.trim() && active ? 'bg-gray-900 hover:bg-black' : 'bg-gray-400 cursor-not-allowed')} disabled={!text.trim() || !active}>
//                         <Send className="w-4 h-4" /> Gửi
//                     </button>
//                 </form>
//             </section>
//         </div>
//     );
// }
