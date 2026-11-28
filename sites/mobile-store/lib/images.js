import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { fail } from './util.js';

// Images are resized and converted to WebP in the browser before upload (see public/js/core.js),
// so the server only checks the bytes are a real, small WebP/JPEG and stores them under a content hash.

export const MAX_UPLOAD = 900 * 1024;
const MAX_SIDE = 2048;

function webpSize(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function jpegSize(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

export function inspectImage(buf) {
  const webp = webpSize(buf);
  if (webp) return { ...webp, ext: 'webp' };
  const jpg = jpegSize(buf);
  if (jpg) return { ...jpg, ext: 'jpg' };
  return null;
}

export function saveImage(storeId, buf) {
  if (!/^s_[\w-]+$/.test(storeId)) fail(400, 'bad_store');
  if (buf.length > MAX_UPLOAD) fail(413, 'image_too_large');
  const info = inspectImage(buf);
  if (!info) fail(415, 'image_type');
  if (!info.w || !info.h || info.w > MAX_SIDE || info.h > MAX_SIDE) fail(422, 'image_dimensions');
  const name = crypto.createHash('sha256').update(buf).digest('base64url').slice(0, 22) + '.' + info.ext;
  const dir = path.join(config.dataDir, 'uploads', storeId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf, { mode: 0o644 });
  return { file: name, w: info.w, h: info.h, bytes: buf.length };
}

export function uploadPath(storeId, name) {
  if (!/^s_[\w-]+$/.test(storeId) || !/^[\w-]{22}\.(webp|jpg)$/.test(name)) return null;
  return path.join(config.dataDir, 'uploads', storeId, name);
}

export function removeUnused(storeId, names) {
  for (const n of names) {
    const p = uploadPath(storeId, n);
    if (p) fs.rm(p, { force: true }, () => {});
  }
}
