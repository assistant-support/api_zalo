// app/form/ui/PublicRegistrationForm.client.jsx
'use client';

import { useMemo, useRef } from 'react';
import { useActionFeedback } from '@/hooks/useAction';
import { viewUrlFromId } from '@/functions/client';
// Đường import action: đổi cho khớp dự án của bạn
import { submitPublicRegistrationAction } from '@/data/customers/wraperdata.db';

function SubmitButton({ disabled, loading }) {
    return (
        <button
            type="submit"
            disabled={loading || disabled}
            className="w-full rounded-[6px] px-4 py-2 font-semibold hover:brightness-110 disabled:opacity-60"
            style={{ background: 'var(--primary-600)', color: 'white' }}
        >
            {loading ? 'Đang xử lý…' : 'Đăng ký ngay'}
        </button>
    );
}

export default function PublicRegistrationForm({ data, services, disabled = false }) {
    const formRef = useRef(null);

    const act = useActionFeedback({
        autoRefresh: false,
        successMessage: 'Đăng ký thành công! Chúng tôi sẽ liên hệ sớm.',
        errorMessage: (res) => res?.error || 'Không thể gửi đăng ký.',
        onSuccess: () => formRef.current?.reset(),
    });

    // Map field IDs -> cấu hình input (map 'Địa chỉ' -> area)
    const serviceOptions = useMemo(() => (Array.isArray(services) ? services : []), [services]);

    const allFields = useMemo(
        () => ({
            1: { id: 'name', name: 'name', label: 'Họ và tên', type: 'text', required: true, autoComplete: 'name' },
            2: { id: 'area', name: 'area', label: 'Địa chỉ', type: 'text', required: false, autoComplete: 'street-address' },
            3: {
                id: 'phone',
                name: 'phone',
                label: 'Số điện thoại liên lạc',
                type: 'tel',
                required: true,
                note: 'Vui lòng dùng SĐT có Zalo để nhận thông tin.',
                pattern: '^0\\d{9}$',
                autoComplete: 'tel',
            },
            4: { id: 'email', name: 'email', label: 'Email', type: 'email', required: false, autoComplete: 'email' },
            5: { id: 'bd', name: 'bd', label: 'Ngày sinh', type: 'date', required: false },
            6: {
                id: 'service',
                name: 'service',
                label: 'Dịch vụ quan tâm',
                type: 'select',
                required: true,
                options: serviceOptions,
            },
        }),
        [serviceOptions]
    );

    const fieldsToRender = Array.isArray(data?.formInput) ? data.formInput : [];

    // Submit -> build payload -> gọi server action qua hook
    const onSubmit = async (e) => {
        e.preventDefault();
        if (disabled) {
            act.toast('Form hiện đang tạm đóng.', 'info');
            return;
        }
        const fd = new FormData(e.currentTarget);
        const payload = {
            source: data?._id,
            sourceName: data?.name,
            name: fd.get('name')?.toString().trim(),
            area: fd.get('area')?.toString().trim(),
            phone: fd.get('phone')?.toString().trim(),
            email: fd.get('email')?.toString().trim(),
            bd: fd.get('bd')?.toString().trim(),
            service: fd.get('service')?.toString().trim(),
        };
        await act.run(submitPublicRegistrationAction, [payload]);
    };

    return (
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
            {/* Banner */}
            <div className="relative">
                <div className="aspect-[16/7] bg-[var(--surface-2)]">
                    {data?.cover ? (
                        <img src={viewUrlFromId(data.cover)} alt={data?.name || 'Form banner'} className="h-full w-full object-cover" />
                    ) : (
                        <img
                            src={'https://lh3.googleusercontent.com/d/1MBJLhxhlVFbp35yylFm77v2gVq6xm_qL'}
                            alt={data?.name || 'Form banner'}
                            className="h-full w-full object-cover"
                        />
                    )}
                </div>

                {/* Tiêu đề + mô tả */}
                <div className="px-4 py-5 md:px-6 md:py-6">
                    <h1
                        className="text-xl md:text-2xl font-bold leading-tight"
                        style={{ textAlign: 'center', textTransform: 'uppercase' }}
                    >
                        {data?.name || 'Đăng ký'}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--muted)]" style={{ textAlign: 'center' }}>
                        {data?.describe || ''}
                    </p>
                </div>
            </div>

            {/* Form */}
            <form ref={formRef} onSubmit={onSubmit} className="px-4 pb-5 md:px-6 md:pb-6 space-y-4" noValidate>
                {/* Hidden nguồn form */}
                <input type="hidden" name="source" value={data?._id || ''} />
                <input type="hidden" name="sourceName" value={data?.name || ''} />

                {/* Cảnh báo nếu form đóng */}
                {disabled && (
                    <div className="rounded-[6px] border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                        Form hiện đang tạm đóng. Bạn chưa thể gửi đăng ký.
                    </div>
                )}

                {/* Render động các trường */}
                <div className="grid grid-cols-1 gap-4">
                    {fieldsToRender.map((fid) => {
                        const field = allFields[fid];
                        if (!field) return null;

                        if (field.type === 'select') {
                            return (
                                <div key={field.id} className="space-y-1.5">
                                    <label htmlFor={field.id} className="text-sm font-medium">
                                        {field.label} {field.required && <span className="text-red-600">*</span>}
                                    </label>
                                    <select
                                        id={field.id}
                                        name={field.name}
                                        required={field.required}
                                        defaultValue=""
                                        className="w-full rounded-[6px] border px-3 py-2 text-sm outline-none focus:ring bg-white"
                                        style={{ borderColor: 'var(--border)' }}
                                        disabled={disabled}
                                    >
                                        <option value="" disabled>
                                            -- Chọn {field.label.toLowerCase()} --
                                        </option>
                                        {field.options.map((opt) => (
                                            <option key={opt._id || opt.value || opt} value={opt._id || opt.value || opt}>
                                                {opt.name || opt.label || String(opt)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        }

                        return (
                            <div key={field.id} className="space-y-1.5">
                                <label htmlFor={field.id} className="text-sm font-medium">
                                    {field.label} {field.required && <span className="text-red-600">*</span>}
                                </label>
                                <input
                                    id={field.id}
                                    name={field.name}
                                    type={field.type}
                                    required={field.required}
                                    pattern={field.pattern}
                                    autoComplete={field.autoComplete}
                                    disabled={disabled}
                                    className="w-full rounded-[6px] border px-3 py-2 text-sm outline-none focus:ring bg-white"
                                    style={{ borderColor: 'var(--border)' }}
                                    placeholder={field.placeholder}
                                />
                                {field.note && <p className="text-xs text-[var(--muted)]">{field.note}</p>}
                            </div>
                        );
                    })}
                </div>

                {/* Submit */}
                <SubmitButton disabled={disabled} loading={act.loading} />

                {/* Message */}
                {act.message && (
                    <div
                        className={`mt-2 rounded-[6px] border px-3 py-2 text-sm ${act.status === 'success'
                            ? 'text-[var(--success-700)] bg-[var(--success-50)]'
                            : act.status === 'error'
                                ? 'text-[var(--danger-700)] bg-[var(--danger-50)]'
                                : ''
                            }`}
                        style={{ borderColor: 'var(--border)' }}
                    >
                        {act.message}
                    </div>
                )}
            </form>
        </div>
    );
}
