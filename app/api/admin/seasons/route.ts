import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { requireRole, ADMINS } from '@/lib/staff-gate';

export async function GET() {
  try {
    const db = getSqliteDb();
    const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all();
    return NextResponse.json(seasons);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Writes are Admin-only (reads stay public for the catalog pages).
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json();
    const db = getSqliteDb();

    const season_id = body.season_id || `season_${Date.now()}`;

    db.prepare(`
      INSERT INTO seasons (
        season_id, type, islamic_year, gregorian_year, name, start_date, end_date, status,
        description, official_information, agency_information
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(season_id) DO UPDATE SET
        type = excluded.type,
        islamic_year = excluded.islamic_year,
        gregorian_year = excluded.gregorian_year,
        name = excluded.name,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        status = excluded.status,
        description = excluded.description,
        official_information = excluded.official_information,
        agency_information = excluded.agency_information
    `).run(
      season_id,
      body.type || 'UMRAH',
      body.islamic_year || '1448',
      body.gregorian_year || '2026',
      body.name,
      body.start_date,
      body.end_date,
      body.status || 'UPCOMING',
      body.description,
      body.official_information,
      body.agency_information
    );

    return NextResponse.json({ success: true, season_id, message: 'تم حفظ الموسم بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  // Writes are Admin-only (reads stay public for the catalog pages).
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });

    const db = getSqliteDb();
    db.prepare('DELETE FROM seasons WHERE season_id = ?').run(id);

    return NextResponse.json({ success: true, message: 'تم حذف الموسم بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
