// /lib/drive.js
import { google } from 'googleapis';

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

export async function uploadBufferToDrive({ name, mime, buffer, folderId = '19-dJALj2I-mDwNn6SNSkIl92a5MeEP5Y' }) {
    const drive = await getDriveClient();
    const metadata = { name, ...(folderId ? { parents: [folderId] } : {}) };
    const media = { mimeType: mime || 'application/octet-stream', body: Buffer.isBuffer(buffer) ? ReadableFrom(buffer) : buffer };

    const { data } = await drive.files.create({
        requestBody: metadata,
        media,
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink'
    });

    // make it viewable if needed (optional)
    try {
        await drive.permissions.create({
            fileId: data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        });
    } catch { }

    // fetch file info after permission
    const { data: info } = await drive.files.get({
        fileId: data.id,
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink'
    });

    return info;
}

function ReadableFrom(buffer) {
    // minimal Readable stream from Buffer (no extra deps)
    const { Readable } = require('stream');
    const r = new Readable({ read() { this.push(buffer); this.push(null); } });
    return r;
}
