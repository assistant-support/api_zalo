// data/customers/wraperdata.db.js
'use server';

/**
 * CUSTOMER ACTIONS (rút gọn)
 * ------------------------------------------------------------
 * WRITE
 *   - submitPublicRegistrationAction(input)
 *   - createOrMergeCustomerFromForm(payload)
 *
 * READ (có scope theo role = 'sale')
 *   - customers_list(searchParams)       -> { items, total, page, pageSize, pages, hasMore }
 *   - customers_default()                -> alias list mặc định
 *   - customers_one_scoped(id)           -> chi tiết 1 KH
 *
 * Cache:
 *   - Sử dụng unstable_cache + tags: ['customers'] cho các hàm READ.
 *   - Các hàm WRITE gọi revalidateTag('customers') sau khi ghi DB.
 */

import mongoose from 'mongoose';
import { revalidateTag, unstable_cache } from 'next/cache';

import { connectMongo } from '@/lib/db_connect';
import Customer from '@/models/customer.model';
import Form from '@/models/formclient';
import { getSessionUserLite } from '@/app/actions/session.action';
import { queryCustomersList, queryCustomerOne } from './handledata.db';

// Đảm bảo model service được khởi tạo (nếu nơi khác populate/lookup)
import '@/models/services.model';

// ==============================
// HẰNG & TIỆN ÍCH CHUNG
// ==============================
const ADMIN_ID = '68bbeb85b5a30d8280aec250';
const NEW_STATUS = 'new_unconfirmed_1';

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(id); } catch { return null; }
}

function normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('0')) return digits;
    if (digits.length === 11 && digits.startsWith('84')) return '0' + digits.slice(2);
    if (digits.length === 9) return '0' + digits;
    return digits;
}

function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function ensureArrayIds(arr) {
    if (!arr) return [];
    const src = Array.isArray(arr) ? arr : [arr];
    return src.map(toObjectId).filter(Boolean);
}

/** Đảm bảo pipelineStatus là mảng và 2 phần tử đầu = NEW_STATUS */
function ensurePipelineForNew(cur) {
    let arr = [];
    if (Array.isArray(cur)) arr = [...cur];
    else if (typeof cur === 'string' && cur) arr = [cur];
    arr[0] = NEW_STATUS;
    arr[1] = NEW_STATUS;
    return arr;
}

// ==============================
// A) WRITE — THÊM / GỘP
// ==============================

/**
 * Nhận FormData/object từ client và forward về createOrMergeCustomerFromForm
 * Trả về { success, error? }
 */
export async function submitPublicRegistrationAction(input) {
    try {
        let payload = input;
        if (typeof FormData !== 'undefined' && input instanceof FormData) {
            payload = Object.fromEntries(input.entries());
        }

        const res = await createOrMergeCustomerFromForm({
            source: payload.source,         // formId (bắt buộc)
            sourceName: payload.sourceName, // ghi chú nguồn hiển thị
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            area: payload.area,
            bd: payload.bd,                 // (optional) ngày sinh -> sẽ đưa vào sourceDetails
            service: payload.service,       // serviceId (single) -> sẽ map sang tags
            // zaloavt, zaloname, tags... nếu có cũng forward bình thường
        });

        return res?.success ? { success: true } : { success: false, error: res?.error || 'Không thể tạo/gộp khách hàng.' };
    } catch (err) {
        console.error('[submitPublicRegistrationAction] error:', err);
        return { success: false, error: 'Có lỗi xảy ra khi gửi đăng ký.' };
    }
}

/**
 * Tạo hoặc gộp khách hàng theo phone:
 * - Nếu chưa tồn tại: tạo mới, thêm care mặc định, pipelineStatus [NEW, NEW]
 * - Nếu đã tồn tại : gộp các trường có giá trị mới (không đè bằng chuỗi rỗng), log care “gộp”
 * - Sau khi ghi DB: revalidateTag('customers')
 */
export async function createOrMergeCustomerFromForm(payload = {}) {
    try {
        await connectMongo();

        // actor: lấy từ session, fallback ADMIN
        const me = await getSessionUserLite().catch(() => null);
        const actorId = toObjectId(me?.id) || toObjectId(ADMIN_ID);

        const {
            source, sourceName,
            name, phone, email, area, address,
            bd, tags, service,
            zaloavt, zaloname,
            sourceDetails,
        } = payload;

        if (!source) return { success: false, error: 'Thiếu form nguồn (source).' };

        const phoneNorm = normalizePhone(phone);
        if (!name || !phoneNorm) return { success: false, error: 'Thiếu Họ và Tên hoặc Số điện thoại.' };
        if (email && !isValidEmail(email)) return { success: false, error: 'Email không hợp lệ.' };

        // Lấy tên form nếu cần
        let formName = (sourceName || '').trim();
        if (!formName) {
            const f = await Form.findById(source).select('name').lean();
            formName = f?.name || '';
        }

        // Build sourceDetails
        const detailsBuilt = [
            formName ? `Form: ${formName}` : '',
            bd ? `DOB: ${bd}` : '',
        ].filter(Boolean).join(' | ');
        const finalSourceDetails = String(sourceDetails || detailsBuilt).trim();

        // tags từ service hoặc array tags
        const tagIds = ensureArrayIds(tags || (service ? [service] : []));

        const baseFields = {
            name: String(name).trim(),
            email: (email || '').trim(),
            phone: phoneNorm,
            area: String(area || address || '').trim(),
            source: toObjectId(source),
            sourceDetails: finalSourceDetails,
            zaloavt: zaloavt || '',
            zaloname: zaloname || '',
            ...(tagIds.length ? { tags: tagIds } : {}),
        };

        const now = new Date();
        const exist = await Customer.findOne({ phone: phoneNorm });

        const careAdd = {
            content: `Được thêm vào hệ thống thông qua form ${formName || ''}`.trim(),
            step: 1,
            createBy: toObjectId(ADMIN_ID),
            createAt: now,
        };

        if (!exist) {
            // --- TẠO MỚI ---
            const doc = new Customer({
                ...baseFields,
                care: [careAdd],
                pipelineStatus: ensurePipelineForNew(undefined),
                assignedBy: actorId,
                assignedAt: now,
            });
            await doc.save();

            // invalidate cache danh sách/chi tiết
            revalidateTag('customers');

            return { success: true, data: { id: String(doc._id), merged: false } };
        }

        // --- GỘP ---
        const fieldsToCompare = ['name', 'email', 'area', 'sourceDetails', 'zaloavt', 'zaloname'];
        const changes = [];

        for (const key of fieldsToCompare) {
            const oldVal = exist[key] ?? '';
            const newVal = baseFields[key] ?? '';
            if (newVal && String(newVal) !== String(oldVal)) {
                changes.push(`${key}: ${oldVal || '—'} -> ${newVal}`);
                exist[key] = newVal;
            }
        }

        if (baseFields.tags) {
            const oldArr = (exist.tags || []).map(String);
            const newArr = baseFields.tags.map(String);
            if (String(oldArr) !== String(newArr)) {
                changes.push(`tags: [${oldArr.join(',') || '—'}] -> [${newArr.join(',')}]`);
                exist.tags = baseFields.tags;
            }
        }

        exist.care = exist.care || [];
        exist.care.push(careAdd);

        if (changes.length) {
            exist.care.push({
                content: `Hành động gộp hồ sơ: Cập nhập trường ${changes.join('; ')}`,
                step: 1,
                createBy: toObjectId(ADMIN_ID),
                createAt: now,
            });
        }

        exist.pipelineStatus = ensurePipelineForNew(exist.pipelineStatus);
        exist.assignedBy = actorId;
        exist.assignedAt = now;

        await exist.save();

        // invalidate cache danh sách/chi tiết
        revalidateTag('customers');

        return { success: true, data: { id: String(exist._id), merged: true, changed: changes.length } };
    } catch (err) {
        if (err?.code === 11000 && err?.keyPattern?.phone) {
            return { success: false, error: 'Số điện thoại đã tồn tại (lỗi unique).' };
        }
        console.error('[customers.actions] createOrMergeCustomerFromForm error:', err);
        return { success: false, error: 'Không thể xử lý khách hàng từ form.' };
    }
}

// ==============================
// B) READ — DANH SÁCH / CHI TIẾT (có scope)
// ==============================

/**
 * Scope:
 * - User có role = 'sale' -> chỉ xem khách có assignees.user = me.id
 * - Role khác            -> xem tất cả
 */
function resolveScopeFromMe(me) {
    const roles = [
        ...(Array.isArray(me?.roles) ? me.roles : []),
        ...(me?.role ? [me.role] : []),
    ].map(String);

    const isSale = roles.includes('sale');
    if (isSale && me?.id) {
        return { restrictToAssigneeUserId: toObjectId(me.id) };
    }
    return {};
}

/** Chuẩn hoá tham số tìm kiếm từ UI thành filters/sort/page/pageSize cho tầng DB */
function normalizeSearchParams(searchParams = {}) {
    const {
        q,
        source,                 // formId
        assignee,               // userId
        tag, tags,              // 1 id hoặc nhiều id
        phase,                  // zaloPhase
        status, statuses,       // 1 hoặc nhiều string
        createdFrom, createdTo, // YYYY-MM-DD
        hasCare,                // 'true' | 'false'
        sort,                   // '-createAt' | 'lastCareAt' | ...
        page,
        pageSize,
    } = searchParams;

    const tagIds = tags ?? tag;
    const pipelineStatuses = statuses ?? status;

    return {
        filters: {
            q: q?.trim() || undefined,
            sourceId: source || undefined,
            assigneeId: assignee || undefined,
            tagIds: tagIds ? (Array.isArray(tagIds) ? tagIds : [tagIds]) : [],
            zaloPhase: phase || undefined,
            pipelineStatuses: pipelineStatuses
                ? (Array.isArray(pipelineStatuses) ? pipelineStatuses : [pipelineStatuses])
                : [],
            createdFrom: createdFrom || undefined,
            createdTo: createdTo || undefined,
            hasCare: typeof hasCare === 'string' ? hasCare === 'true' : undefined,
        },
        sort: sort || '-createAt',
        page: Number(page) > 0 ? Number(page) : 1,
        pageSize: [10, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 10,
    };
}

/**
 * Lấy danh sách khách hàng (đã enforce scope theo role), có cache theo tag 'customers'
 */
export async function customers_list(searchParams = {}) {
    const me = await getSessionUserLite().catch(() => null);
    const scope = resolveScopeFromMe(me);
    const opts = normalizeSearchParams(searchParams);

    const scopeKey = scope?.restrictToAssigneeUserId?.toString() || 'all';
    const paramsKey = JSON.stringify(opts);

    // Cache theo scope + params; bị invalid bởi revalidateTag('customers')
    const getList = unstable_cache(
        () => queryCustomersList({ ...opts, scope }),
        ['customers', 'list', scopeKey, paramsKey],
        { tags: ['customers'] }
    );

    return getList();
}

/** Alias: danh sách mặc định (page=1, size=10) */
export async function customers_default() {
    return customers_list({});
}

/** Lấy chi tiết 1 khách hàng (scope-aware), có cache theo tag 'customers' */
export async function customers_one_scoped(id) {
    const me = await getSessionUserLite().catch(() => null);
    const scope = resolveScopeFromMe(me);

    const scopeKey = scope?.restrictToAssigneeUserId?.toString() || 'all';
    const idKey = String(id);

    const getOne = unstable_cache(
        () => queryCustomerOne(id, scope),
        ['customers', 'one', scopeKey, idKey],
        { tags: ['customers'] }
    );

    return getOne();
}
