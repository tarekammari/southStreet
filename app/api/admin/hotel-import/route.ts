import { NextRequest, NextResponse } from 'next/server';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { getSqliteDb } from '@/lib/sqlite';
import { dbLogAudit } from '@/lib/db';
import { ensureHotelSchema } from '@/lib/hotels/store';
import { HOTEL_COUNTRIES } from '@/lib/tour';

export const dynamic = 'force-dynamic';

/**
 * Super Admin: find hotels of a city in OpenStreetMap (free, open data —
 * names, stars, address, location; never prices) and import the chosen ones
 * into the hotels table, hidden and not bookable until staff add rooms,
 * photos and prices. Usage stays light: one geocode + up to two searches (~1 request/second).
 *   GET  ?city=إسطنبول&country=TR → candidates
 *   POST {city, country, items:[…]} → imports (skips hotels already imported)
 * Map data © OpenStreetMap contributors (ODbL).
 */

const UA = 'SouthStreetAgency/1.0 (hotel catalogue import; southstreet.1zayd1.tech)';

type Candidate = {
  osm_id: string;
  name: string;
  name_local?: string;
  stars: number;
  address: string;
  latitude: number;
  longitude: number;
  website?: string;
  phone?: string;
  imported: boolean;
};

async function getJson(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  ensureHotelSchema();
  const p = new URL(req.url).searchParams;
  const city = String(p.get('city') || '').trim().slice(0, 60);
  const country = HOTEL_COUNTRIES.find((c) => c.id === p.get('country'));
  if (city.length < 2) return NextResponse.json({ error: 'اكتب اسم المدينة' }, { status: 400 });
  try {
    const geo = await getJson(
      `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: country ? `${city}, ${country.label}` : city, format: 'json', limit: '1', 'accept-language': 'ar' })}`
    );
    const place = Array.isArray(geo) ? geo[0] : null;
    if (!place?.boundingbox) return NextResponse.json({ error: 'لم نجد هذه المدينة على الخريطة' }, { status: 404 });
    let [south, north, west, east] = place.boundingbox.map(Number);
    // Very large areas (a whole province): keep 15 km around the centre.
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    if (north - south > 0.3 || east - west > 0.3) {
      south = lat - 0.135;
      north = lat + 0.135;
      west = lon - 0.17;
      east = lon + 0.17;
    }
    // Hotels inside the city's box, from Nominatim (fast and reliable; the
    // Overpass servers are often overloaded). Two pages of 50, ~1 request/second.
    const elements: any[] = [];
    const seen: string[] = [];
    for (let page = 0; page < 2; page++) {
      if (page) await new Promise((r) => setTimeout(r, 1100));
      const batch = await getJson(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
          q: 'hotel',
          format: 'jsonv2',
          limit: '50',
          extratags: '1',
          addressdetails: '1',
          'accept-language': 'ar',
          viewbox: `${west},${north},${east},${south}`,
          bounded: '1',
          ...(seen.length ? { exclude_place_ids: seen.join(',') } : {}),
        })}`
      );
      const list = Array.isArray(batch) ? batch : [];
      for (const x of list) {
        seen.push(String(x.place_id));
        if (x.category !== 'tourism' || x.type !== 'hotel') continue;
        const a = x.address || {};
        elements.push({
          type: x.osm_type,
          id: x.osm_id,
          lat: Number(x.lat),
          lon: Number(x.lon),
          tags: {
            name: x.name || x.namedetails?.name,
            stars: x.extratags?.stars,
            website: x.extratags?.website || x.extratags?.['contact:website'],
            phone: x.extratags?.phone || x.extratags?.['contact:phone'],
            'addr:street': a.road,
            'addr:housenumber': a.house_number,
            'addr:suburb': a.suburb || a.neighbourhood || a.quarter,
            'addr:city': a.city || a.town || a.village,
          },
        });
      }
      if (list.length < 50) break;
    }
    const data = { elements };
    const have = new Set(
      (getSqliteDb().prepare("SELECT source_id FROM hotels WHERE source_type = 'osm'").all() as { source_id: string }[]).map((r) => String(r.source_id))
    );
    const items: Candidate[] = (Array.isArray(data?.elements) ? data.elements : [])
      .map((e: any) => {
        const t = e.tags || {};
        const name = String(t['name:ar'] || t.name || t['name:en'] || '').trim();
        const latitude = Number(e.lat ?? e.center?.lat);
        const longitude = Number(e.lon ?? e.center?.lon);
        const osm_id = `${e.type}/${e.id}`;
        return {
          osm_id,
          name,
          name_local: t.name && t.name !== name ? String(t.name) : undefined,
          stars: Math.max(0, Math.min(5, parseInt(String(t.stars || '0'), 10) || 0)),
          address: [t['addr:street'] && `${t['addr:housenumber'] || ''} ${t['addr:street']}`.trim(), t['addr:suburb'] || t['addr:district'], t['addr:city']].filter(Boolean).join('، '),
          latitude,
          longitude,
          website: t.website || t['contact:website'] || undefined,
          phone: t.phone || t['contact:phone'] || undefined,
          imported: have.has(osm_id),
        };
      })
      .filter((c: Candidate) => c.name && Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
      // The same hotel is often mapped twice (a point and its building): keep one per name.
      .filter((c: Candidate, i: number, all: Candidate[]) => all.findIndex((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase()) === i)
      .sort((a: Candidate, b: Candidate) => b.stars - a.stars || a.name.localeCompare(b.name));
    return NextResponse.json({ place: place.display_name, items: items.slice(0, 150), attribution: '© OpenStreetMap contributors' });
  } catch (err: any) {
    return NextResponse.json({ error: `تعذّر الاتصال بخريطة OpenStreetMap (${err?.message || 'خطأ'}) — أعد المحاولة بعد قليل` }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  ensureHotelSchema();
  const b = await req.json().catch(() => ({}));
  const city = String(b.city || '').trim().slice(0, 60);
  const country = HOTEL_COUNTRIES.find((c) => c.id === b.country)?.id || '';
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60);
  if (!city || !items.length) return NextResponse.json({ error: 'اختر الفنادق' }, { status: 400 });
  const db = getSqliteDb();
  const exists = db.prepare("SELECT 1 AS x FROM hotels WHERE source_type = 'osm' AND source_id = ?");
  const insert = db.prepare(`
    INSERT INTO hotels (hotel_id, name, city, category, address, latitude, longitude, distance_from_haram, description, services, images, videos, status,
      country, stars, website, source_type, source_id, bookable)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '[]', '[]', '[]', 'INACTIVE', ?, ?, ?, 'osm', ?, 0)
  `);
  let added = 0;
  db.transaction(() => {
    for (const it of items) {
      const osmId = String(it.osm_id || '');
      const name = String(it.name || '').trim().slice(0, 140);
      if (!osmId || !name || exists.get(osmId)) continue;
      const stars = Math.max(0, Math.min(5, Number(it.stars) || 0));
      insert.run(
        `htl_osm_${osmId.replace(/\W/g, '_')}`,
        name,
        city,
        stars ? `${stars}_STAR` : '3_STAR',
        String(it.address || '').slice(0, 200),
        Number(it.latitude) || null,
        Number(it.longitude) || null,
        country,
        stars || null,
        String(it.website || '').slice(0, 200),
        osmId
      );
      added += 1;
    }
  })();
  try {
    dbLogAudit(String(gate.account.name || 'المشرف العام'), gate.role, 'استيراد فنادق', `${added} فندق — ${city} (OpenStreetMap)`);
  } catch {
    /* optional */
  }
  return NextResponse.json({ added, message: `أُضيف ${added} فندق — مخفية وغير قابلة للحجز حتى تضيف الصور والغرف والأسعار` });
}
