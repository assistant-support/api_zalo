import { service_data, createService, updateService, setServiceActive, reloadServices } from '@/data/services/wraperdata.db';
import ServicesTable from './ServicesTable.client';

export default async function ServiceManagerServer() {
    const services = await service_data();
    return (
        <div className="px-6 py-6 space-y-6" style={{ color: 'var(--text)', background: 'var(--surface-2)' }}>
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Quản lý dịch vụ</h1>
            </header>
            <section className="rounded-[6px] border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
                <ServicesTable
                    initialData={services || []}
                    actions={{ createService, updateService, setServiceActive, reloadServices }}
                />
            </section>
        </div>
    );
}
