// app/form/page.jsx
import { form_data } from '@/data/forms/wraperdata.db';
import { service_data } from '@/data/services/wraperdata.db';
import PublicRegistrationForm from './ui/PublicRegistrationForm.client';

export const dynamic = 'force-dynamic';

export default async function FormPage({ searchParams }) {
    const { id } = searchParams ?? {};
    const data = await form_data(id);
    const service = await service_data();

    // Nếu không có form hoặc form bị tắt, hiển thị thông báo nhẹ
    const closed = !data || data?.status === false;

    return (
        <div className="min-h-dvh bg-[var(--primary-100)] py-4 px-3">
            <div className="mx-auto w-full max-w-3xl">
                {data ? (
                    <PublicRegistrationForm data={data} services={service} disabled={closed} />
                ) : (
                    <div className="rounded-[6px] border bg-white/70 p-6 text-center text-[var(--muted)]"
                        style={{ borderColor: 'var(--border)' }}>
                        Không tìm thấy form.
                    </div>
                )}
            </div>
        </div>
    );
}
