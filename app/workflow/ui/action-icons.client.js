'use client';

// app/workflow/ui/action-icons.client.js
import {
    Search,
    UserRoundPen,
    MessageSquare,
    Tags,
    Bell,
    Phone,
    CalendarClock,
    BellRing,
    Stethoscope,
    CheckCircle2,
    HeartPulse,
    Square
} from 'lucide-react';

export function iconForAction(name = '') {
    const M = {
        findUid: Search,
        updateZaloName: UserRoundPen,
        sendZaloMessage: MessageSquare,
        assignByTags: Tags,
        notifyStatus: Bell,
        manualCall: Phone,
        notifyScheduleCustomer: CalendarClock,
        notifyGroupReminder: BellRing,
        notifyPreSurgery: Stethoscope,
        notifyGroupClosed: CheckCircle2,
        notifyPostSurgery: HeartPulse,
    };
    return M[name] || Square;
}
