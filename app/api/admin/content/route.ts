import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const db = getSqliteDb();

    let sql = 'SELECT * FROM page_content';
    const params: any[] = [];
    if (section) {
      sql += ' WHERE section = ?';
      params.push(section);
    }

    const rows = db.prepare(sql).all(...params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getSqliteDb();

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
      body.key,
      body.section || 'general',
      body.title_ar,
      body.title_fr,
      body.title_en,
      body.content_ar,
      body.content_fr,
      body.content_en,
      body.image_url,
      new Date().toISOString()
    );

    return NextResponse.json({ success: true, message: 'تم تحديث المحتوى بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
