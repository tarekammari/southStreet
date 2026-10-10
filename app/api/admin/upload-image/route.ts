import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { requireRole, ADMINS } from '@/lib/staff-gate';
import { mediaGoesToDatabase, saveMedia } from '@/lib/media-store';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function inferMime(file: File): string {
  if (file.type && (IMAGE_TYPES.includes(file.type) || VIDEO_TYPES.includes(file.type))) return file.type;
  return EXT_MIME[path.extname(file.name || '').toLowerCase()] || '';
}

function writeBoth(filename: string, buffer: Buffer) {
  const destinations = [
    path.join(process.cwd(), 'images', 'uploads'),
    path.join(process.cwd(), 'public', 'images', 'uploads'),
  ];
  for (const dir of destinations) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
  }
}

async function toSmallWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { animated: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}

function compressVideo(input: Buffer): Promise<Buffer> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inPath = path.join(os.tmpdir(), `hotel-in-${stamp}`);
  const outPath = path.join(os.tmpdir(), `hotel-out-${stamp}.mp4`);
  fs.writeFileSync(inPath, input);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'ffmpeg',
      [
        '-y',
        '-i',
        inPath,
        '-vf',
        "scale='min(1280,iw)':-2",
        '-c:v',
        'libx264',
        '-crf',
        '30',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
        outPath,
      ],
      { windowsHide: true }
    );
    proc.on('error', reject);
    proc.on('close', (code) => {
      try {
        if (code !== 0 || !fs.existsSync(outPath)) {
          reject(new Error('تعذر ضغط الفيديو'));
          return;
        }
        resolve(fs.readFileSync(outPath));
      } catch (err) {
        reject(err);
      } finally {
        fs.rmSync(inPath, { force: true });
        fs.rmSync(outPath, { force: true });
      }
    });
  });
}

export async function POST(req: NextRequest) {
  // Writes are Admin-only (reads stay public for the catalog pages).
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    const mime = inferMime(file);
    const isVideo = VIDEO_TYPES.includes(mime);
    const isImage = IMAGE_TYPES.includes(mime);
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: 'استخدم صورة PNG أو JPG أو WebP، أو فيديو MP4' }, { status: 400 });
    }
    if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
      return NextResponse.json({ error: isVideo ? 'حجم الفيديو يتجاوز 80 ميغابايت' : 'حجم الصورة يتجاوز 12 ميغابايت' }, { status: 400 });
    }

    // No lasting disk (Vercel): images are kept in the database; videos are too big for it.
    const toDatabase = mediaGoesToDatabase();
    if (toDatabase && isVideo) {
      return NextResponse.json({ error: 'رفع الفيديو غير متاح على النسخة التجريبية — سيعمل على الخادم الدائم (VPS)' }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    let buffer: Buffer = raw;
    const safeBase = (file.name || 'upload')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.[^.]+$/, '')
      .slice(0, 40) || 'upload';

    let ext = '.webp';
    if (isImage && mime !== 'image/svg+xml') {
      buffer = Buffer.from(await toSmallWebp(raw));
      ext = '.webp';
    } else if (isVideo) {
      try {
        buffer = Buffer.from(await compressVideo(raw));
      } catch {
        buffer = raw;
      }
      ext = '.mp4';
    }

    let filename = `${Date.now()}_${safeBase}${ext}`;
    if (toDatabase) filename = saveMedia(buffer, 'image/webp', '.webp');
    else writeBoth(filename, buffer);

    return NextResponse.json({
      success: true,
      url: `/api/staff-image/${filename}`,
      filename,
      message: 'تم الرفع',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل الرفع';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
