import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Mirroring images/ -> public/images/ only needs to happen once per process.
 * Doing it per request made every card image pay for a full directory scan.
 */
let mirrored = false;
function mirrorImagesOnce() {
  if (mirrored) return;
  mirrored = true;
  try {
    const srcDir = path.join(process.cwd(), 'images');
    const publicDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(srcDir)) return;
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const dest = path.join(publicDir, entry.name);
      if (fs.existsSync(dest)) continue;
      try { fs.copyFileSync(path.join(srcDir, entry.name), dest); } catch {}
    }
  } catch {}
}

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const resolvedPaths = new Map<string, string>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const resolvedParams = await params;
  const filename = resolvedParams?.filename;

  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  mirrorImagesOnce();

  let targetPath = resolvedPaths.get(filename) || '';
  if (!targetPath) {
    const candidates = [
      path.join(process.cwd(), 'images', filename),
      path.join(process.cwd(), 'public', 'images', filename),
      path.join(process.cwd(), 'images', 'uploads', filename),
      path.join(process.cwd(), 'public', 'images', 'uploads', filename),
    ];
    targetPath = candidates.find((p) => fs.existsSync(p)) || '';
    if (!targetPath) return new NextResponse('File not found', { status: 404 });
    resolvedPaths.set(filename, targetPath);
  }

  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
  const stat = await fs.promises.stat(targetPath);
  const range = request.headers.get('range');
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? Number(match[1]) : 0;
    const end = match && match[2] ? Number(match[2]) : stat.size - 1;
    const stream = fs.createReadStream(targetPath, { start, end });
    const buf = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
    return new NextResponse(new Uint8Array(buf), {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const fileBuffer = await fs.promises.readFile(targetPath);

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
