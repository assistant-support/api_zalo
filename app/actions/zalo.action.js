'use server';

// Hàm này giờ đây chỉ có nhiệm vụ đọc trạng thái từ globalThis
export async function getZaloState() {
    return {
        isLoggedIn: !!globalThis.zaloApi,
        messages: globalThis.receivedMessages || [],
    };
}