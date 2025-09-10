'use server';

import { revalidateTag } from 'next/cache';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { connectMongo } from '@/lib/db_connect';
import Form from '@/models/formclient';
import '@/models/account.model'; // để populate createdBy nếu cần ở nơi khác
import { getFormAll, getFormOne } from './handledata.db';
import { getSessionUserLite } from '@/app/actions/session.action';
import { uploadBufferToDrive } from '@/lib/drive';

/* ----------------------- Helpers ----------------------- */
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// Nhận JSON string hoặc array -> trả mảng số không âm
function parseFormInput(input) {
    if (input == null) return [];
    let arr = input;
    if (typeof input === 'string') {
        try { arr = JSON.parse(input); } catch { arr = []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 0);
}

// data:image/<mime>;base64,<...>
function dataURLtoParts(dataURL) {
    if (typeof dataURL !== 'string') return null;
    const m = /^data:([^;]+);base64,(.+)$/i.exec(dataURL);
    if (!m) return null;
    const mime = m[1];
    const base64 = m[2];
    return { mime, buffer: Buffer.from(base64, 'base64') };
}

function fileNameFor(name = 'form') {
    const base = String(name)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return `form-cover-${base || 'item'}-${Date.now()}.jpg`;
}

/** Upload banner (nếu là dataURL); trả về driveId (string) hoặc null nếu không đổi */
async function ensureDriveIdFromCover(cover, nameHint) {
    if (!cover) return null;
    const parts = dataURLtoParts(cover);
    if (!parts) return null; // không phải dataURL -> bỏ qua
    const stream = Readable.from(parts.buffer);
    const info = await uploadBufferToDrive({
        name: fileNameFor(nameHint),
        mime: parts.mime,
        buffer: stream,
    });
    return info?.id || null;
}

/* ----------------------- READ ----------------------- */
export async function form_data(id) {
    return id ? getFormOne(id) : getFormAll();
}
export async function reloadForm() {
    revalidateTag('forms');
}

/* ----------------------- CREATE ----------------------- */
export async function createForm(formData) {
    try {
        const me = await getSessionUserLite();
        if (!me || !me.id) {
            return { success: false, error: 'Không xác thực được người dùng.' };
        }
        await connectMongo();

        const {
            name,
            describe = '',
            formInput,
            status,       // optional boolean
            cover,        // dataURL / driveId / '' (clear)
        } = formData || {};

        const payload = {
            name: str(name),
            describe: str(describe),
            createdBy: me.id,
            formInput: parseFormInput(formInput),
        };
        if (typeof status === 'boolean') payload.status = status;

        // xử lý cover
        if (typeof cover === 'string') {
            if (cover === '') {
                payload.cover = '';
            } else {
                const driveId = await ensureDriveIdFromCover(cover, payload.name);
                if (driveId) payload.cover = driveId;
                else if (/^[A-Za-z0-9_-]{20,}$/.test(cover)) payload.cover = cover; // nhận driveId nếu user truyền sẵn
            }
        }

        if (!payload.name) return { success: false, error: 'Tên form là bắt buộc.' };

        const created = await Form.create(payload);
        revalidateTag('forms');
        return {
            success: true,
            data: { id: String(created._id), name: created.name, status: created.status, cover: created.cover },
        };
    } catch (err) {
        console.error('[forms] createForm error:', err);
        return { success: false, error: 'Không thể tạo form.' };
    }
}

/* ----------------------- UPDATE ----------------------- */
export async function updateForm(id, formData) {
    try {
        const me = await getSessionUserLite();
        if (!me || !me.id) {
            return { success: false, error: 'Không xác thực được người dùng.' };
        }
        await connectMongo();
        const doc = await Form.findById(id);
        if (!doc) return { success: false, error: 'Form không tồn tại.' };

        const { name, describe, formInput, status, cover } = formData || {};

        if (name != null) doc.name = str(name);
        if (describe != null) doc.describe = str(describe);
        if (formInput != null) doc.formInput = parseFormInput(formInput);
        if (typeof status === 'boolean') doc.status = status;

        // cập nhật cover
        if (cover !== undefined) {
            if (cover === '') {
                doc.cover = '';
            } else if (typeof cover === 'string') {
                const driveId = await ensureDriveIdFromCover(cover, doc.name);
                if (driveId) doc.cover = driveId;
                else if (/^[A-Za-z0-9_-]{20,}$/.test(cover)) doc.cover = cover;
                // nếu cover là URL/viewLink -> bỏ qua, không tự parse
            }
        }

        await doc.save();
        revalidateTag('forms');
        return { success: true, data: { cover: doc.cover } };
    } catch (err) {
        console.error('[forms] updateForm error:', err);
        return { success: false, error: 'Không thể cập nhật form.' };
    }
}

/* ----------------------- SOFT DELETE / TOGGLE ----------------------- */
export async function setFormStatus(id, active) {
    try {
        const me = await getSessionUserLite();
        if (!me || !me.id) {
            return { success: false, error: 'Không xác thực được người dùng.' };
        }
        await connectMongo();
        const doc = await Form.findById(id);
        if (!doc) return { success: false, error: 'Form không tồn tại.' };
        doc.status = !!active;
        await doc.save();
        revalidateTag('forms');
        return { success: true, data: { status: doc.status } };
    } catch (err) {
        console.error('[forms] setFormStatus error:', err);
        return { success: false, error: 'Không thể đổi trạng thái form.' };
    }
}

/* ----------------------- HARD DELETE — không dùng ----------------------- */
export async function hardDeleteForm(/* id */) {
    return { success: false, error: 'Chính sách: không xoá cứng. Dùng setFormStatus(id, false).' };
}
