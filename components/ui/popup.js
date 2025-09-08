'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Popup — tái sử dụng, thuần Tailwind.
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - header: ReactNode (bắt buộc, luôn hiển thị)
 *  - footer?: ReactNode (tuỳ chọn)
 *  - widthClass?: string (max width)
 *  - disableOutsideClose?: boolean
 *
 * Đặc tính:
 *  - Hiệu ứng mở mượt.
 *  - Chiều cao tổng khối = max-h-[90vh].
 *  - Header/Footer cao bằng nhau (mặc định h-14).
 *  - Khu vực chính luôn có className 'scroll' để lăn nội dung.
 */
export default function Popup({
    open,
    onClose,
    header,
    footer,
    widthClass = 'max-w-3xl',
    disableOutsideClose = false,
    children,
}) {
    const [show, setShow] = useState(false);
    const panelRef = useRef(null);

    // mount animation
    useEffect(() => {
        if (open) {
            // next frame để transition mượt
            const t = requestAnimationFrame(() => setShow(true));
            return () => cancelAnimationFrame(t);
        } else {
            setShow(false);
        }
    }, [open]);

    // escape để đóng
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // click outside
    const onOverlayClick = (e) => {
        if (disableOutsideClose) return;
        if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };

    if (!open) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 transition-opacity ${show ? 'opacity-100' : 'opacity-0'
                }`}
            onMouseDown={onOverlayClick}
        >
            <div
                ref={panelRef}
                className={`w-full ${widthClass} max-h-[90vh] bg-[var(--surface)] border shadow-xl rounded-[6px] flex flex-col transition transform ${show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                    }`}
                style={{ borderColor: 'var(--border)' }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header (h-14) */}
                <div
                    className="h-14 flex items-center justify-between px-4 border-b"
                    style={{ borderColor: 'var(--border)' }}
                >
                    <div className="font-semibold truncate">{header}</div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-[6px] hover:bg-[var(--surface-2)]"
                        aria-label="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Main (scroll) */}
                <div className="scroll flex-1 overflow-y-auto px-4 py-4">
                    {children}
                </div>

                {/* Footer (h-14) — tuỳ chọn */}
                {footer !== undefined && (
                    <div
                        className="h-14 flex items-center justify-end gap-2 px-4 border-t"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
