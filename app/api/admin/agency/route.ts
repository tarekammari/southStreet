import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export async function GET() {
  try {
    const db = getSqliteDb();
    const row = db.prepare("SELECT * FROM agency_settings WHERE id = 'main'").get() as any;
    if (!row) {
      return NextResponse.json({ error: 'البيانات غير موجودة' }, { status: 404 });
    }
    return NextResponse.json({
      ...row,
      supported_languages: JSON.parse(row.supported_languages || '[]')
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const db = getSqliteDb();

    db.prepare(`
      UPDATE agency_settings SET
        agency_name = ?,
        legal_name = ?,
        logo = ?,
        description = ?,
        address = ?,
        city = ?,
        country = ?,
        phone = ?,
        whatsapp = ?,
        email = ?,
        website = ?,
        opening_hours = ?,
        emergency_phone = ?,
        supported_languages = ?,
        default_currency = ?,
        timezone = ?
      WHERE id = 'main'
    `).run(
      body.agency_name,
      body.legal_name,
      body.logo,
      body.description,
      body.address,
      body.city,
      body.country,
      body.phone,
      body.whatsapp,
      body.email,
      body.website,
      body.opening_hours,
      body.emergency_phone,
      JSON.stringify(body.supported_languages || []),
      body.default_currency || 'DZD',
      body.timezone || 'Africa/Algiers'
    );

    return NextResponse.json({ success: true, message: 'تم تحديث بيانات الوكالة بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
