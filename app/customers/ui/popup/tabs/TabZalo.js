'use client';

export default function TabZalo({ customer }) {
    return (
        <div className="rounded-xl border bg-white p-4">
            <div className="font-medium mb-3">Zalo</div>
            <div className="text-sm text-gray-500">
                UID: {(customer?.uid || []).map(u => u?.uid).filter(Boolean).join(', ') || '—'}
            </div>
        </div>
    );
}
