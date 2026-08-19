import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export async function GET() {
  try {
    const db = getSqliteDb();
    const rows = db.prepare('SELECT * FROM hotels ORDER BY name ASC').all() as any[];
    const hotels = rows.map(h => ({
      ...h,
      services: JSON.parse(h.services || '[]'),
      images: JSON.parse(h.images || '[]'),
      videos: JSON.parse(h.videos || '[]')
    }));
    return NextResponse.json(hotels);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getSqliteDb();

    const hotel_id = body.hotel_id || `htl_${Date.now()}`;

    db.prepare(`
      INSERT INTO hotels (
        hotel_id, name, city, category, address, latitude, longitude, distance_from_haram,
        description, services, images, videos, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hotel_id) DO UPDATE SET
        name = excluded.name,
        city = excluded.city,
        category = excluded.category,
        address = excluded.address,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        distance_from_haram = excluded.distance_from_haram,
        description = excluded.description,
        services = excluded.services,
        images = excluded.images,
        videos = excluded.videos,
        status = excluded.status
    `).run(
      hotel_id,
      body.name,
      body.city || 'MAKKAH',
      body.category || '4_STAR',
      body.address,
      body.latitude || 21.42,
      body.longitude || 39.82,
      body.distance_from_haram,
      body.description,
      JSON.stringify(body.services || []),
      JSON.stringify(body.images || []),
      JSON.stringify(body.videos || []),
      body.status || 'ACTIVE'
    );

    return NextResponse.json({ success: true, hotel_id, message: 'تم حفظ الفندق بنجاح في قاعدة البيانات' });
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
    db.prepare('DELETE FROM hotels WHERE hotel_id = ?').run(id);

    return NextResponse.json({ success: true, message: 'تم حذف الفندق بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
