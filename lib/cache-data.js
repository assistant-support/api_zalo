// lib/cache-data.js
// -------------------------------------------------------------
// SAFE wrapper cho Next 15 / React 19:
// - KHÔNG bọc react.cache lên unstable_cache (tránh lỗi frame.join...)
// - Giữ API tương thích: cacheData(fn, keysOrTags)
//   -> keysOrTags sẽ dùng làm cả "keyParts" và "tags"

import { unstable_cache } from 'next/cache';

/**
 * @param {Function} fn              - async function không đối số hoặc nhận đối số
 * @param {string|string[]} keysOrTags - mảng key ổn định (và cũng dùng làm tags)
 * @returns {Function} cached function => nhớ gọi hàm trả về (vd: const get = cacheData(...); return get();)
 */
export function cacheData(fn, keysOrTags = []) {
    const arr = Array.isArray(keysOrTags) ? keysOrTags : [String(keysOrTags || 'key')];
    const keyParts = arr.map(String);
    const tags = arr.map(String);

    const cached = unstable_cache(fn, keyParts, { tags, revalidate: false });
    // Trả về function để caller gọi như trước
    return (...args) => cached(...args);
}
