// app/customers/ui/popup/CustomerDetailPopup.client.jsx
'use client';

import { useMemo, useState } from 'react';
import Popup from '@/components/ui/popup';
import { useActionFeedback } from '@/hooks/useAction';
import { LayoutGrid, Clock, User2, CalendarDays, Phone, MessageCircle } from 'lucide-react';

import TabTimeline from './tabs/TabTimeline';
import TabHistory from './tabs/TabHistory';
import TabInfo from './tabs/TabInfo';
import TabSchedule from './tabs/TabSchedule';
import TabCall from './tabs/TabCall';
import TabZalo from './tabs/TabZalo';

const TAB_DEFS = [
    { key: 'timeline', label: 'Lịch trình', icon: LayoutGrid, comp: TabTimeline },
    { key: 'history', label: 'Lịch sử', icon: Clock, comp: TabHistory },
    { key: 'info', label: 'Thông tin', icon: User2, comp: TabInfo },
    { key: 'schedule', label: 'Lịch hẹn', icon: CalendarDays, comp: TabSchedule },
    { key: 'call', label: 'Cuộc gọi', icon: Phone, comp: TabCall },
    { key: 'zalo', label: 'Zalo', icon: MessageCircle, comp: TabZalo },
];

export default function CustomerDetailPopup({ open, onClose, customer }) {
    const [active, setActive] = useState('timeline');
    const { run } = useActionFeedback();

    const ActiveComp = useMemo(
        () => TAB_DEFS.find(t => t.key === active)?.comp || TabTimeline,
        [active]
    );

    if (!open || !customer) return null;
    console.log(customer);
    
    return (
        <Popup
            open={open}
            onClose={onClose}
            widthClass="max-w-6xl"
            header={
                <div className="flex items-center gap-3">
                    <div className="min-w-0">
                        <div className="font-semibold truncate">Tên khách hàng: {customer.name || '—'}</div>
                        <div className="text-sm text-gray-600">Liên hệ: {customer.phone || '—'}</div>
                    </div>
                </div>
            }
        >
            {/* Wrapper KHÔNG thay đổi component Popup nhưng đảm bảo:
          - Luôn cao 90vh
          - Thân nội dung scroll khi dài */}
            <div className="h-[90vh] overflow-hidden">
                {/* Thân chính chiếm toàn bộ wrapper, phần này mới scroll */}
                <div className="h-full min-h-0 flex gap-4">
                    {/* Panel trái: nội dung tab, cho scroll theo chiều dọc */}
                    <div className="flex-1 min-w-0 overflow-y-auto pr-2">
                        <ActiveComp customer={customer} run={run} />
                    </div>

                    {/* Panel phải: menu tab, sticky để không trôi khi trái scroll */}
                    <aside className="w-64 shrink-0">
                        <div className="sticky top-0 space-y-3">
                            {TAB_DEFS.map(({ key, label, icon: Icon }) => {
                                const activeBtn = active === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActive(key)}
                                        className={`w-full h-14 rounded-xl border px-4 flex items-center gap-3 text-sm font-medium transition
                      ${activeBtn ? 'bg-[#0f172a] text-white border-transparent' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="truncate">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </div>
            </div>
        </Popup>
    );
}
