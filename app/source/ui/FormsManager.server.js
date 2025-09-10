// app/form/ui/FormsManager.server.jsx
import { form_data, reloadForm, createForm, updateForm, setFormStatus } from '@/data/forms/wraperdata.db';
import FormsTable from './FormsTable.client';

export default async function FormsManager() {
    const initialData = await form_data();
    return (
        <div className="px-6 py-6 space-y-6 scroll flex" style={{ color: 'var(--text)', background: 'var(--surface-2)', height: '100%' }}>
            <section className="rounded-[6px] border bg-[var(--surface)] flex-1 flex" style={{ borderColor: 'var(--border)' }}>
                <FormsTable
                    initialData={initialData || []}
                    actions={{ reloadForm, createForm, updateForm, setFormStatus }}
                />
            </section>
        </div>

    );
}
