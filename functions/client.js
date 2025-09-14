// Hàm hỗ trợ xem ngày giờ - định dạng theo múi giờ VN - tránh lỗi Recoverable 
export function formatAtTZ(ts, { locale = 'vi-VN', timeZone = 'Asia/Ho_Chi_Minh', dateStyle = 'short', timeStyle = 'medium', hour12 = false } = {}) {
    const d = ts instanceof Date ? ts : new Date(ts);
    return new Intl.DateTimeFormat(locale, { timeZone, dateStyle, timeStyle, hour12 }).format(d);
}