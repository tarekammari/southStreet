import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export async function GET() {
  try {
    const db = getSqliteDb();
    const rows = db.prepare('SELECT * FROM morshids ORDER BY name ASC').all() as any[];
    const morshids = rows.map(m => ({
      ...m,
      languages: JSON.parse(m.languages || '[]')
    }));
    return NextResponse.json(morshids);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getSqliteDb();

    const morshid_id = body.morshid_id || `msh_${Date.now()}`;

    db.prepare(`
      INSERT INTO morshids (
        morshid_id, name, roleName, specialization, experience_years, languages, phone, avatar, rating, status, category, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(morshid_id) DO UPDATE SET
        name = excluded.name,
        roleName = excluded.roleName,
        specialization = excluded.specialization,
        experience_years = excluded.experience_years,
        languages = excluded.languages,
        phone = excluded.phone,
        avatar = excluded.avatar,
        rating = excluded.rating,
        status = excluded.status,
        category = excluded.category,
        image = excluded.image
    `).run(
      morshid_id,
      body.name,
      body.roleName,
      body.specialization,
      body.experience_years || 5,
      JSON.stringify(body.languages || ['العربية']),
      body.phone,
      body.avatar || (body.name ? body.name.charAt(0) : 'م'),
      body.rating || 4.9,
      body.status || 'متاح',
      body.category || 'religious_guide',
      body.image || '/api/staff-image/morshed_01.png'
    );

    return NextResponse.json({ success: true, morshid_id, message: 'تم حفظ المرشد / العضو بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });

    const db = getSqliteDb();
    db.prepare('DELETE FROM morshids WHERE morshid_id = ?').run(id);

    return NextResponse.json({ success: true, message: 'تم حذف العضو بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
