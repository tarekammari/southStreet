import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export async function GET() {
  try {
    const db = getSqliteDb();
    const pkgRows = db.prepare('SELECT * FROM packages ORDER BY package_id DESC').all() as any[];
    const priceRows = db.prepare('SELECT * FROM package_prices').all() as any[];

    const packages = pkgRows.map(p => ({
      ...p,
      published: Boolean(p.published),
      included_services: JSON.parse(p.included_services || '[]'),
      excluded_services: JSON.parse(p.excluded_services || '[]'),
      booking_conditions: JSON.parse(p.booking_conditions || '[]'),
      prices: priceRows.filter(pr => pr.package_id === p.package_id)
    }));

    return NextResponse.json(packages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getSqliteDb();

    const package_id = body.package_id || `pkg_${Date.now()}`;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO packages (
          package_id, name, type, season_id, season_name, description, start_date, end_date, duration_days,
          departure_city, departure_airport, arrival_airport, airline, makkah_hotel_id, makkah_hotel_name, makkah_hotel_dist,
          madinah_hotel_id, madinah_hotel_name, madinah_hotel_dist, hotel_category, morshid_id, morshid_name,
          included_services, excluded_services, booking_conditions, cancellation_policy, capacity, reserved, available,
          status, published, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        package_id,
        body.name,
        body.type || 'ECONOMY',
        body.season_id,
        body.season_name,
        body.description,
        body.start_date,
        body.end_date,
        body.duration_days || 15,
        body.departure_city,
        body.departure_airport,
        body.arrival_airport,
        body.airline,
        body.makkah_hotel_id,
        body.makkah_hotel_name,
        body.makkah_hotel_dist,
        body.madinah_hotel_id,
        body.madinah_hotel_name,
        body.madinah_hotel_dist,
        body.hotel_category,
        body.morshid_id,
        body.morshid_name,
        JSON.stringify(body.included_services || []),
        JSON.stringify(body.excluded_services || []),
        JSON.stringify(body.booking_conditions || []),
        body.cancellation_policy,
        body.capacity || 40,
        body.reserved || 0,
        body.available || body.capacity || 40,
        body.status || 'PUBLISHED',
        body.published !== false ? 1 : 0,
        body.image_url
      );

      // Delete existing prices if updating
      db.prepare('DELETE FROM package_prices WHERE package_id = ?').run(package_id);

      // Insert Prices
      if (Array.isArray(body.prices)) {
        const insertPrice = db.prepare(`
          INSERT INTO package_prices (price_id, package_id, room_type, traveler_type, currency, amount)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const pr of body.prices) {
          insertPrice.run(
            pr.price_id || `prc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            package_id,
            pr.room_type,
            pr.traveler_type || 'ADULT',
            pr.currency || 'DZD',
            pr.amount
          );
        }
      }
    })();

    return NextResponse.json({ success: true, package_id, message: 'تم حفظ الباقة والأسعار بنجاح في قاعدة البيانات' });
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
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });

    const db = getSqliteDb();
    db.prepare('DELETE FROM packages WHERE package_id = ?').run(id);

    return NextResponse.json({ success: true, message: 'تم حذف الباقة بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
