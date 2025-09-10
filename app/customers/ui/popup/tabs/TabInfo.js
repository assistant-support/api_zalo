'use client';

export default function TabInfo({ customer }) {
    const Row = ({ k, v }) => (
        <div className="grid grid-cols-3 gap-3 py-2">
            <div className="text-sm text-gray-500">{k}</div>
            <div className="col-span-2 text-sm">{v ?? '—'}</div>
        </div>
    );

    return (
        <div className="rounded-xl border bg-white p-4">
            <div className="font-medium mb-3">Thông tin khách hàng</div>
            <Row k="Họ tên" v={customer?.name} />
            <Row k="Số điện thoại" v={customer?.phone} />
            <Row k="Email" v={customer?.email} />
            <Row k="Khu vực" v={customer?.area} />
            <Row k="Nguồn" v={customer?.source?.name} />
            <Row k="Phase" v={customer?.zaloPhase} />
            <Row k="Trạng thái" v={Array.isArray(customer?.pipelineStatus) ? customer.pipelineStatus.join(', ') : customer?.pipelineStatus} />
            <Row k="Dịch vụ" v={(customer?.tags || []).map(t => t.name).join(', ')} />
        </div>
    );
}
