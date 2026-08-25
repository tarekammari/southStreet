import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const db = getSqliteDb();

    const sql = section
      ? 'SELECT * FROM page_content WHERE section = ? ORDER BY key'
      : 'SELECT * FROM page_content ORDER BY section, key';
    const rows = section ? db.prepare(sql).all(section) : db.prepare(sql).all();

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getSqliteDb();
    const key = String(body.key || '').trim() || `block_${Date.now()}`;

    db.prepare(`
      INSERT INTO page_content (key, section, title_ar, title_fr, title_en, content_ar, content_fr, content_en, image_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        section = excluded.section,
        title_ar = excluded.title_ar,
        title_fr = excluded.title_fr,
        title_en = excluded.title_en,
        content_ar = excluded.content_ar,
        content_fr = excluded.content_fr,
        content_en = excluded.content_en,
        image_url = excluded.image_url,
        updated_at = excluded.updated_at
    `).run(
      key,
      body.section || 'general',
      body.title_ar || '',
      body.title_fr || '',
      body.title_en || '',
      body.content_ar || '',
      body.content_fr || '',
      body.content_en || '',
      body.image_url || '',
      new Date().toISOString()
    );

    return NextResponse.json({ success: true, key, message: 'تم تحديث المحتوى بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return POST(req);
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'مفتاح المحتوى مطلوب' }, { status: 400 });

    const db = getSqliteDb();
    db.prepare('DELETE FROM page_content WHERE key = ?').run(key);
    return NextResponse.json({ success: true, message: 'تم حذف المحتوى بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
