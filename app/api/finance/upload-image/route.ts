import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireFinanceAccess } from '@/lib/finance-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function inferMime(file: File): string {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  const ext = path.extname(file.name || '').toLowerCase();
  return EXT_MIME[ext] || '';
}

export async function POST(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'لم يتم إرسال صورة' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الصورة يتجاوز 5 ميغابايت' }, { status: 400 });
    }
    const mime = inferMime(file);
    if (!mime) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    const ext = extMap[mime] || '.png';
    const filename = `fin_${Date.now()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    for (const dir of [
      path.join(process.cwd(), 'images', 'uploads'),
      path.join(process.cwd(), 'public', 'images', 'uploads'),
    ]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buffer);
    }
    return NextResponse.json({ url: `/api/staff-image/${filename}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل رفع الصورة';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
