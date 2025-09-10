// lib/workflow.engine.js (trích phần mới/đổi)
function sortStepsForRuntime(steps = []) {
    // Ưu tiên order; nếu trùng order thì theo index ban đầu
    return [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function buildRuntimeSteps(templateSteps, startTime) {
    const sorted = sortStepsForRuntime(templateSteps);
    const out = [];
    let clock = new Date(startTime);

    for (const s of sorted) {
        let scheduled;
        if (typeof s.delayFromPrevMs === 'number' && s.delayFromPrevMs !== null) {
            // Chuỗi tuyến tính theo bước trước
            clock = new Date(clock.getTime() + s.delayFromPrevMs);
            scheduled = new Date(clock);
        } else {
            // Tương thích cũ: delay từ start
            scheduled = new Date(startTime.getTime() + (s.delayMs || 0));
            // giữ clock = max(clock, scheduled) để chuỗi không chạy "thụt lùi"
            if (scheduled > clock) clock = new Date(scheduled);
        }

        out.push({
            id: s.id,
            action: s.action,
            scheduledTime: scheduled,
            status: 'pending',
            params: s.params || {},
            retryCount: 0,
        });
    }
    return out;
}
