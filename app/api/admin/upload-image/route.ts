import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
};

function inferMime(file: File): string {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  const ext = path.extname(file.name || '').toLowerCase();
  return EXT_MIME[ext] || '';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف صورة' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الصورة يتجاوز 5 ميغابايت' }, { status: 400 });
    }

    const mime = inferMime(file);
    if (!mime) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم. استخدم PNG أو JPG أو WebP' }, { status: 400 });
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
    };
    const ext = extMap[mime] || path.extname(file.name || '').toLowerCase() || '.png';
    const safeBase = (file.name || 'upload')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.[^.]+$/, '')
      .slice(0, 40) || 'upload';
    const filename = `${Date.now()}_${safeBase}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const destinations = [
      path.join(process.cwd(), 'images', 'uploads'),
      path.join(process.cwd(), 'public', 'images', 'uploads'),
    ];
    for (const dir of destinations) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buffer);
    }

    const url = `/api/staff-image/${filename}`;

    return NextResponse.json({
      success: true,
      url,
      filename,
      message: 'تم رفع الصورة بنجاح',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل رفع الصورة';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
