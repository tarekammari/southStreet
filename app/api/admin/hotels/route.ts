import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { requireRole, ADMINS } from '@/lib/staff-gate';
import { isHotelShownOnSite } from '@/lib/record-field-options';

/**
 * List columns are JSON arrays, but rows added from the table editor or by Sakhr
 * can hold plain text ("تكييف مركزي، واي فاي"). One such row used to break the
 * whole list, so parse each one leniently.
 */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* fall through to plain text */
    }
  }
  return text.split(/[،,؛;\r\n]+/).map((s) => s.trim()).filter(Boolean);
}

/** `?site=1` → only the hotels chosen to appear on the public hotels page. */
export async function GET(req: Request) {
  try {
    const db = getSqliteDb();
    const siteOnly = new URL(req.url).searchParams.get('site') === '1';
    const rows = db.prepare('SELECT * FROM hotels ORDER BY name ASC').all() as any[];
    const hotels = rows
      .filter((h) => !siteOnly || isHotelShownOnSite(h.status))
      .map((h) => ({
        ...h,
        services: toList(h.services),
        images: toList(h.images),
        videos: toList(h.videos),
        shown_on_site: isHotelShownOnSite(h.status),
      }));
    return NextResponse.json(hotels);
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
  // Writes are Admin-only (reads stay public for the catalog pages).
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
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
