import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const resolvedParams = await params;
  const filename = resolvedParams?.filename;

  if (!filename || filename.includes('..')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  // Copy all files from root images/ to public/images/ automatically
  try {
    const srcDir = path.join(process.cwd(), 'images');
    const publicDir = path.join(process.cwd(), 'public', 'images');
    if (fs.existsSync(srcDir)) {
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      const files = fs.readdirSync(srcDir);
      for (const f of files) {
        const s = path.join(srcDir, f);
        const d = path.join(publicDir, f);
        if (fs.statSync(s).isFile() && !fs.existsSync(d)) {
          try { fs.copyFileSync(s, d); } catch (_) {}
        }
      }
    }
  } catch (_) {}

  const srcPath = path.join(process.cwd(), 'images', filename);
  const publicPath = path.join(process.cwd(), 'public', 'images', filename);

  let targetPath = '';
  if (fs.existsSync(srcPath)) {
    targetPath = srcPath;
  } else if (fs.existsSync(publicPath)) {
    targetPath = publicPath;
  } else {
    return new NextResponse('File not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(targetPath);
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.svg') contentType = 'image/svg+xml';
  else if (ext === '.webp') contentType = 'image/webp';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
