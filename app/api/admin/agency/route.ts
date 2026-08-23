import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { saveGoogleClientId } from '@/lib/google-auth-config';

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

    if (body.google_client_id != null && body.agency_name == null) {
      saveGoogleClientId(String(body.google_client_id || ''));
      return NextResponse.json({ success: true, message: 'تم حفظ معرف عميل جوجل. يمكن للأعضاء الإنشاء والدخول بجوجل الآن.' });
    }

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
        timezone = ?,
        google_client_id = ?
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
      body.timezone || 'Africa/Algiers',
      (body.google_client_id || '').trim()
    );

    return NextResponse.json({ success: true, message: 'تم تحديث بيانات الوكالة بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
