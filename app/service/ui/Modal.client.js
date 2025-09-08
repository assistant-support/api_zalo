'use client';

import { X } from 'lucide-react';

export default function Modal({ open, title, children, onClose, widthClass = 'max-w-2xl' }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
            <div className={`w-full ${widthClass} rounded-[6px] bg-[var(--surface)] shadow-xl border`}
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-semibold">{title}</div>
                    <button onClick={onClose} className="p-2 rounded-[6px] hover:bg-[var(--surface-2)]">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}
