// app/customers/page.jsx
import { service_data } from '@/data/services/wraperdata.db';
import CustomersTable from './ui/CustomersTable.client';
import { customers_list } from '@/data/customers/wraperdata.db';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }) {
    const {
        scope = 'mine',
        q = '',
        status = '',
        phase = '',
        tag = '',
        page = '1',
        size = '10',
        sort = '-createAt',
    } = searchParams ?? {};

    const { items, total, page: curPage, pageSize, pages, hasMore } =
        await customers_list({
            q, status, phase, tag,
            page, pageSize: size, sort,
        });
    const service = await service_data()
    console.log(items);
    
    return (
        <div className="h-full flex flex-col p-4">
            <CustomersTable
                initialData={Array.isArray(items) ? items : []}
                initialMeta={{ total, page: curPage, pageSize, pages, hasMore, sort }}
                initialParams={{
                    scope, q, status, phase, tag,
                    page: Number(page) || 1,
                    size: Number(size) || 10,
                }}
                service={service}
            />
        </div>
    );
}
