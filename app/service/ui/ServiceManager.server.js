import { service_data, createService, updateService, setServiceActive, reloadServices } from '@/data/services/wraperdata.db';
import ServicesTable from './ServicesTable.client';

export default async function ServiceManagerServer() {
    const services = await service_data();
    return (
        <div className="px-6 py-6 space-y-6 scroll flex" style={{ color: 'var(--text)', background: 'var(--surface-2)', height: '100%' }}>
            <section className="rounded-[6px] border bg-[var(--surface)] flex-1 flex" style={{ borderColor: 'var(--border)' }}>
                <ServicesTable
                    initialData={services || []}
                    actions={{ createService, updateService, setServiceActive, reloadServices }}
                />
            </section>
        </div>
    );
}
