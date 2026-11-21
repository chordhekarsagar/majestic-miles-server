import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

/**
 * Google Drive media helper.
 * Each trip row stores `drive_folder_id`. This module lists every
 * image/GIF inside that folder and returns URLs that point at our own
 * `/api/image/:fileId` proxy (see streamDriveImage below).
 *
 * Requirements: the Drive folder (or each file) must be shared either
 * publicly ("Anyone with the link – Viewer") or with the service
 * account email.
 *
 * Why a proxy instead of hotlinking drive.google.com/thumbnail directly:
 * that endpoint is an unauthenticated, unofficial thumbnail CDN that
 * throttles hard per-IP (429s) once a page fires off more than a
 * handful of concurrent <img> requests, e.g. a trip photo gallery.
 * Proxying through the authenticated Drive API and caching the bytes
 * on disk means Google only sees one request per photo, ever.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '.image-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const apiBase = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}/api`;

let driveClient = null;

async function getDrive() {
  if (driveClient) return driveClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/** URL usable in <img src>, served (and cached) by our own /api/image proxy. */
export function driveImageUrl(fileId) {
  return `${apiBase}/image/${fileId}`;
}

/** List image/GIF files inside a Drive folder. */
export async function listFolderMedia(folderId) {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/')`,
    fields: 'files(id, name, mimeType, imageMediaMetadata(width,height))',
    orderBy: 'name',
    pageSize: 100
  });
  return (res.data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isGif: f.mimeType === 'image/gif',
    url: driveImageUrl(f.id),
    thumb: driveImageUrl(f.id)
  }));
}

/**
 * Streams a Drive file's bytes to `res`, caching them on disk on first
 * request so every later request for the same fileId is served locally
 * instead of hitting Google again.
 */
export async function streamDriveImage(fileId, res) {
  const cachePath = path.join(CACHE_DIR, fileId);
  const metaPath = `${cachePath}.json`;

  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    const { mimeType } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    fs.createReadStream(cachePath).pipe(res);
    return;
  }

  const drive = await getDrive();
  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const mimeType = meta.data.mimeType;
  const fileRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  res.set('Content-Type', mimeType);
  res.set('Cache-Control', 'public, max-age=604800, immutable');

  const tmpPath = `${cachePath}.tmp`;
  const writeStream = fs.createWriteStream(tmpPath);
  fileRes.data.pipe(writeStream);
  fileRes.data.pipe(res);

  writeStream.on('finish', () => {
    fs.renameSync(tmpPath, cachePath);
    fs.writeFileSync(metaPath, JSON.stringify({ mimeType }));
  });
  writeStream.on('error', () => fs.unlink(tmpPath, () => {}));
}
