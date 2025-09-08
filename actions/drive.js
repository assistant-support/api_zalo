// /actions/drive.js
// Upload file lên Google Drive, trả về id + link. Giới hạn định dạng/kích thước.

import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

// ===== CẤU HÌNH GIỚI HẠN =====
export const FILE_MAX_MB = Number(process.env.FILE_MAX_MB || 20);

export const EXT_MIME = {
    // ảnh
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    // video ngắn
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    // tài liệu
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ALLOWED_EXT = new Set(Object.keys(EXT_MIME));

// ===== AUTH DRIVE =====
export async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
}

// ===== TIỆN ÍCH =====
export function detectMimeByExt(filename) {
    const ext = (path.extname(filename).replace('.', '') || '').toLowerCase();
    return EXT_MIME[ext] || 'application/octet-stream';
}

export function ensureAllowed(filePath, filename) {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > FILE_MAX_MB) {
        throw new Error(`File quá lớn (${sizeMB.toFixed(1)}MB), tối đa ${FILE_MAX_MB}MB`);
    }
    const ext = (path.extname(filename).replace('.', '') || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
        throw new Error(`Định dạng không hỗ trợ: .${ext}`);
    }
    return true;
}

/** Upload lên Drive + set quyền anyone:reader.
 *  Trả về: { id, webViewLink, webContentLink, thumbnailLink }
 */
export async function uploadToDriveAndMakePublic(filePath, { name, mimeType, folderId }) {
    const drive = await getDriveClient();

    const fileMeta = {
        name: name || path.basename(filePath),
        parents: folderId ? [folderId] : undefined,
    };
    const media = {
        mimeType: mimeType || detectMimeByExt(name || filePath),
        body: fs.createReadStream(filePath),
    };

    const createRes = await drive.files.create({
        requestBody: fileMeta,
        media,
        fields: 'id, name',
    });

    const fileId = createRes.data.id;

    // public read
    await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
    });

    // get links
    const getRes = await drive.files.get({
        fileId,
        fields: 'id, webViewLink, webContentLink, thumbnailLink',
    });

    return {
        id: fileId,
        webViewLink: getRes.data.webViewLink || '',
        webContentLink: getRes.data.webContentLink || '',
        thumbnailLink: getRes.data.thumbnailLink || '',
    };
}
