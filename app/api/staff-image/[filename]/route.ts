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

  const fileBuffer = await fs.promises.readFile(targetPath);
  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'image/png';

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
