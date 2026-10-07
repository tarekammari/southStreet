import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { parsePackageList } from '@/lib/package-lists';
import { ensurePackageRoomPrices, parseAnnexes } from '@/lib/package-options';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireAdmin(req: Request) {
  const gate = requireRole(req, ADMINS);
  return 'error' in gate ? null : gate.payload;
}

export async function GET(req: Request) {
  try {
    const db = getSqliteDb();
    const admin = requireAdmin(req);
    // Guests (BookingWizard /book) only see published packages; admins see all.
    const pkgRows = (
      admin
        ? db.prepare('SELECT * FROM packages ORDER BY package_id DESC').all()
        : db.prepare("SELECT * FROM packages WHERE IFNULL(published,0) = 1 OR published = '1' OR UPPER(IFNULL(status,'')) = 'PUBLISHED' ORDER BY package_id DESC").all()
    ) as any[];

    for (const p of pkgRows) ensurePackageRoomPrices(db, String(p.package_id || ''));
    const priceRowsAfter = db.prepare('SELECT * FROM package_prices').all() as any[];

    const packages = pkgRows.map(p => ({
      ...(admin ? p : {
        package_id: p.package_id,
        name: p.name,
        type: p.type,
        season_id: p.season_id,
        season_name: p.season_name,
        description: p.description,
        start_date: p.start_date,
        end_date: p.end_date,
        duration_days: p.duration_days,
        departure_city: p.departure_city,
        departure_airport: p.departure_airport,
        arrival_airport: p.arrival_airport,
        airline: p.airline,
        makkah_hotel_name: p.makkah_hotel_name,
        madinah_hotel_name: p.madinah_hotel_name,
        hotel_category: p.hotel_category,
        morshid_name: p.morshid_name,
        capacity: p.capacity,
        reserved: p.reserved,
        available: p.available,
        status: p.status,
        image_url: p.image_url,
      }),
      featured: Number(p.featured) === 1,
      published: Boolean(p.published),
      included_services: parsePackageList(p.included_services),
      excluded_services: parsePackageList(p.excluded_services),
      booking_conditions: parsePackageList(p.booking_conditions),
      prices: priceRowsAfter.filter(pr => pr.package_id === p.package_id),
      annex_options: parseAnnexes(p.annex_options),
    }));

    return NextResponse.json(packages, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });
    const body = await req.json();
    const db = getSqliteDb();

    if (body.options_only && body.package_id) {
      const package_id = String(body.package_id);
      db.transaction(() => {
        db.prepare('UPDATE packages SET annex_options = ? WHERE package_id = ?').run(
          JSON.stringify(Array.isArray(body.annex_options) ? body.annex_options : parseAnnexes(null)),
          package_id
        );
        if (Array.isArray(body.prices)) {
          db.prepare('DELETE FROM package_prices WHERE package_id = ?').run(package_id);
          const insertPrice = db.prepare(`
            INSERT INTO package_prices (price_id, package_id, room_type, traveler_type, currency, amount)
            VALUES (?, ?, ?, 'ADULT', 'DZD', ?)
          `);
          for (const pr of body.prices) {
            const amount = Math.max(0, Number(pr.amount) || 0);
            if (!amount || !pr.room_type) continue;
            insertPrice.run(
              pr.price_id || `prc_${package_id}_${String(pr.room_type).toLowerCase()}`,
              package_id,
              String(pr.room_type).toUpperCase(),
              amount
            );
          }
        }
        ensurePackageRoomPrices(db, package_id);
      })();
      return NextResponse.json({ success: true, package_id });
    }

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
      if (body.annex_options) {
        db.prepare('UPDATE packages SET annex_options = ? WHERE package_id = ?').run(
          JSON.stringify(body.annex_options),
          package_id
        );
      }

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
    ensurePackageRoomPrices(db, package_id);

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
    if (!requireAdmin(req)) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });
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
