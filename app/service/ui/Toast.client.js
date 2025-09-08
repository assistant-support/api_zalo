'use client';

import { useEffect } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

export default function Toast({ toasts = [], onClose }) {
    // toasts: array of {id, type: 'success'|'error'|'info', message}
    useEffect(() => {
        if (!toasts?.length) return;
        const t = setTimeout(() => {
            const top = toasts[0];
            onClose?.(top.id);
        }, 2800);
        return () => clearTimeout(t);
    }, [toasts]);

    if (!toasts?.length) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
            {toasts.map(t => {
                const isSuccess = t.type === 'success';
                const isError = t.type === 'error';
                return (
                    <div key={t.id}
                        className="flex items-center gap-3 rounded-[6px] px-4 py-3 shadow-lg border bg-[var(--surface)]"
                        style={{ borderColor: 'var(--border)' }}>
                        {isSuccess && <CheckCircle2 className="w-5 h-5 text-[var(--success-600)]" />}
                        {isError && <XCircle className="w-5 h-5 text-[var(--danger-700)]" />}
                        {!isSuccess && !isError && <div className="w-5 h-5 rounded-full" style={{ background: 'var(--primary-400)' }} />}
                        <div className="text-sm">{t.message}</div>
                        <button onClick={() => onClose?.(t.id)} className="ml-2 p-1 rounded-[6px] hover:bg-[var(--surface-2)]">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
