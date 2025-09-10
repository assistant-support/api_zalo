'use client';

export default function TabHistory({ customer }) {
    const care = (customer?.care ?? []).slice().sort((a, b) => new Date(b.createAt) - new Date(a.createAt));
    return (
        <div className="rounded-xl border bg-white p-4">
            <div className="font-medium mb-3">Nhật ký chăm sóc</div>
            {care.length === 0 ? (
                <div className="text-sm text-gray-500">Chưa có lịch sử.</div>
            ) : (
                <div className="space-y-3">
                    {care.map((c, i) => (
                        <div key={i} className="rounded-lg border p-3">
                            <div className="flex items-center text-xs text-gray-500 mb-1">
                                <span>{c?.createBy?.name || 'Hệ thống'}</span>
                                <span className="mx-2">•</span>
                                <span>{new Date(c.createAt).toLocaleString()}</span>
                                {typeof c.step === 'number' && <span className="ml-auto italic">step {c.step}</span>}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{c.content || '—'}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
