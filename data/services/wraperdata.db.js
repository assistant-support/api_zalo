'use server';

import { revalidateTag } from 'next/cache';
import { connectMongo } from '@/lib/db_connect';
import Service from '@/models/services.model';
import { getServiceAll, getServiceOne } from '@/data/services/handledata.db';
import { getSessionUserLite } from '@/app/actions/session.action';

export async function service_data(id) {
  return id ? getServiceOne(id) : getServiceAll();
}

export async function reloadServices() {
  revalidateTag('services');
}

/** helpers */
function parseJSONMaybe(input, fallback) {
  if (input == null) return fallback;
  if (Array.isArray(input) || typeof input === 'object') return input;
  try { return JSON.parse(String(input)); } catch { return fallback; }
}

function normalizeCosts(costs) {
  const arr = parseJSONMaybe(costs, []);
  return arr
    .filter(Boolean)
    .map(x => ({
      name: String(x.name || '').trim(),
      description: String(x.description || '').trim(),
      amount: Number(x.amount || 0)
    }))
    .filter(x => x.name && x.amount >= 0);
}

/** CREATE */
export async function createService(formData) {
  try {
    const me = await getSessionUserLite();
    if (!me || !me.id) {
      return { success: false, error: 'Không xác thực được người dùng.' };
    }

    await connectMongo();

    const {
      name,
      type,
      description = '',
      costs,                 // JSON string/array [{name, description, amount}]
      customTexts            // JSON string/object { preOp:{...}, postOp:{...}, documents:[...] }
    } = formData;

    const payload = {
      name: String(name || '').trim(),
      type,
      description: String(description || '').trim(),
      costs: normalizeCosts(costs),
      customTexts: parseJSONMaybe(customTexts, undefined)
    };

    const created = await Service.create(payload);
    revalidateTag('services');
    return { success: true, data: { id: String(created._id), slug: created.slug } };
  } catch (err) {
    // lỗi trùng slug/name (E11000)
    if (err && err.code === 11000) {
      return { success: false, error: 'Tên/slug dịch vụ đã tồn tại.' };
    }
    console.error('createService error:', err);
    return { success: false, error: 'Không thể tạo dịch vụ.' };
  }
}

/** UPDATE */
export async function updateService(id, formData) {
  try {
    const me = await getSessionUserLite();
    if (!me || !me.id) {
      return { success: false, error: 'Không xác thực được người dùng.' };
    }

    await connectMongo();

    const {
      name,
      type,
      description = '',
      costs,
      customTexts,
      isActive
    } = formData;

    const svc = await Service.findById(id);
    if (!svc) return { success: false, error: 'Dịch vụ không tồn tại.' };

    if (name != null) svc.name = String(name).trim();
    if (type != null) svc.type = type;
    if (description != null) svc.description = String(description).trim();
    if (costs != null) svc.costs = normalizeCosts(costs);
    if (customTexts != null) svc.customTexts = parseJSONMaybe(customTexts, svc.customTexts);
    if (typeof isActive === 'boolean') svc.isActive = isActive;

    await svc.save();
    revalidateTag('services');
    return { success: true };
  } catch (err) {
    if (err && err.code === 11000) {
      return { success: false, error: 'Tên/slug dịch vụ đã tồn tại.' };
    }
    console.error('updateService error:', err);
    return { success: false, error: 'Không thể cập nhật dịch vụ.' };
  }
}

/** TOGGLE ACTIVE (soft delete) */
export async function setServiceActive(id, active) {
  try {
    const me = await getSessionUserLite();
    if (!me || !me.id) {
      return { success: false, error: 'Không xác thực được người dùng.' };
    }

    await connectMongo();
    const svc = await Service.findById(id);
    if (!svc) return { success: false, error: 'Dịch vụ không tồn tại.' };

    // (tùy chọn) Nếu muốn chặn tắt khi đang có lead đang dùng:
    // const count = await Lead.countDocuments({ serviceId: svc._id });
    // if (!active && count > 0) {
    //   return { success: false, error: 'Dịch vụ đang được sử dụng, không thể tắt.' };
    // }

    svc.isActive = !!active;
    await svc.save();

    revalidateTag('services');
    return { success: true, data: { isActive: svc.isActive } };
  } catch (err) {
    console.error('setServiceActive error:', err);
    return { success: false, error: 'Không thể đổi trạng thái dịch vụ.' };
  }
}

/** HARD DELETE (không khuyến nghị; để trống nếu không dùng) */
export async function hardDeleteService(/* id */) {
  return { success: false, error: 'Chính sách: không xóa cứng. Dùng setServiceActive(id, false).' };
}
