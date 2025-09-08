'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * useActionFeedback — hook chuẩn hoá gọi async action cho toàn dự án.
 * - run(actionFn, args?, options?) -> res
 * - loading: boolean
 * - status: 'idle' | 'loading' | 'success' | 'error'
 * - message: chuỗi message cuối cùng (để bind vào Toast nếu muốn)
 *
 * options:
 *  - autoRefresh: boolean (default: true) -> router.refresh() khi success
 *  - successMessage: string | (res) => string
 *  - errorMessage: string | (err|res) => string
 *  - onSuccess: (res) => void
 *  - onError: (err|res) => void
 *  - silent: boolean -> không tự tạo message
 */
export function useActionFeedback(defaults = {}) {
    const router = useRouter();
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false);

    const run = useCallback(
        async (actionFn, args = [], options = {}) => {
            const {
                autoRefresh = defaults.autoRefresh ?? true,
                successMessage = defaults.successMessage,
                errorMessage = defaults.errorMessage,
                onSuccess = defaults.onSuccess,
                onError = defaults.onError,
                silent = false,
            } = options;

            setStatus('loading');
            setLoading(true);
            setMessage('');

            try {
                const res = await actionFn(...(Array.isArray(args) ? args : [args]));
                const ok = res?.success !== false;

                if (ok) {
                    setStatus('success');
                    if (!silent) {
                        const msg =
                            typeof successMessage === 'function'
                                ? successMessage(res)
                                : successMessage || 'Thao tác thành công.';
                        setMessage(msg);
                    }
                    onSuccess?.(res);
                    if (autoRefresh) startTransition(() => router.refresh());
                } else {
                    setStatus('error');
                    if (!silent) {
                        const msg =
                            typeof errorMessage === 'function'
                                ? errorMessage(res)
                                : res?.error || errorMessage || 'Thao tác thất bại.';
                        setMessage(msg);
                    }
                    onError?.(res);
                }

                return res;
            } catch (err) {
                setStatus('error');
                const msg =
                    typeof options.errorMessage === 'function'
                        ? options.errorMessage(err)
                        : err?.message || defaults.errorMessage || 'Có lỗi xảy ra.';
                if (!silent) setMessage(msg);
                onError?.(err);
                return { success: false, error: msg };
            } finally {
                setLoading(false);
            }
        },
        [defaults, router]
    );

    return useMemo(
        () => ({
            run,
            loading: loading || isPending,
            status,
            message,
            clearMessage: () => setMessage(''),
        }),
        [run, loading, isPending, status, message]
    );
}
