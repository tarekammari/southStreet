/**
 * Loads an agency profile folder into «هوية الوكالة» — run on the server, in
 * the agency's app folder:
 *
 *   npm run brand:import -- deploy/agencies/hebla-tours
 *   npm run brand:import -- /var/lib/south-street/<slug>/profile
 *
 * The folder holds brand.json (see lib/brand-profile.ts), the logo and images/.
 * Images are copied to images/uploads as brand-<slug>-<name> and served by
 * /api/staff-image/…; the same names are reused, so running it again only
 * refreshes the brand. Fields the profile does not state stay empty.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { profileToBrand, type BrandProfile } from '../lib/brand-profile';
import { saveBrand } from '../lib/brand-server';
import { mediaGoesToDatabase, saveMedia } from '../lib/media-store';
import { getSqliteDb } from '../lib/sqlite';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

/**
 * The profile's current programme (starterProgram) as a published package.
 * Same id every run: the package is updated, never duplicated, and seats
 * already booked are kept. No price in the profile → no price rows, and the
 * site shows «السعر عند الطلب» until the agency sets one in the dashboard.
 */
function importStarterProgram(profile: BrandProfile, slug: string, asset: (rel: string) => string): string {
  const p = profile.starterProgram;
  if (!p?.name || !p.start_date) return '';
  const db = getSqliteDb();
  const id = String(p.id || `pac_brand_${slug}_starter`).replace(/[^\w-]/g, '_');
  const kind = p.kind === 'TOURISM' || p.kind === 'HAJJ' ? p.kind : 'UMRAH';
  const seats = Math.max(1, Math.round(Number(p.seats) || 0)) || null;
  const image = p.image ? asset(p.image) : '';
  const existing = db.prepare('SELECT reserved FROM packages WHERE package_id = ?').get(id) as { reserved?: number } | undefined;
  const reserved = Number(existing?.reserved) || 0;
  const row = {
    name: p.name,
    type: kind === 'TOURISM' ? 'رحلة سياحية' : kind === 'HAJJ' ? 'حج' : 'عمرة',
    season_name: p.season || null,
    description: p.description || null,
    start_date: p.start_date,
    end_date: p.end_date || null,
    duration_days: Number(p.duration_days) || null,
    departure_city: p.departure_city || null,
    departure_airport: p.departure_airport || null,
    morshid_name: p.guides || null,
    capacity: seats,
    available: seats ? Math.max(0, seats - reserved) : null,
    status: 'PUBLISHED',
    published: 1,
    featured: p.featured ? 1 : 0,
    image_url: image || null,
    trip_type: kind,
  };
  const cols = Object.keys(row) as (keyof typeof row)[];
  if (existing) {
    db.prepare(`UPDATE packages SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE package_id = ?`).run(...cols.map((c) => row[c]), id);
  } else {
    db.prepare(`INSERT INTO packages (package_id, reserved, ${cols.join(', ')}) VALUES (?, 0, ${cols.map(() => '?').join(', ')})`).run(id, ...cols.map((c) => row[c]));
  }
  const price = Number(p.price) || 0;
  if (price > 0) {
    db.prepare('DELETE FROM package_prices WHERE package_id = ?').run(id);
    db.prepare(`INSERT INTO package_prices (price_id, package_id, room_type, traveler_type, currency, amount) VALUES (?, ?, 'QUAD', 'ADULT', 'DZD', ?)`).run(`prc_${id}_quad`, id, price);
  }
  return `${p.name} — ${p.start_date}${seats ? ` · ${seats} مقعد` : ''}${price ? ` · ${price.toLocaleString('ar-DZ')} دج` : ' · السعر عند الطلب'}`;
}

function main() {
  const dir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('-')) || '');
  const file = path.join(dir, 'brand.json');
  if (!fs.existsSync(file)) {
    console.error(`brand.json not found in ${dir}\nUsage: npm run brand:import -- <profile folder>`);
    process.exit(1);
  }
  const profile = JSON.parse(fs.readFileSync(file, 'utf8')) as BrandProfile;
  const slug = String(profile.slug || path.basename(dir)).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'agency';

  const urls = new Map<string, string>();
  const asset = (rel: string): string => {
    if (urls.has(rel)) return urls.get(rel)!;
    const src = path.resolve(dir, rel);
    const ext = path.extname(src).toLowerCase();
    if (!src.startsWith(dir + path.sep) || !fs.existsSync(src) || !MIME[ext]) {
      console.warn(`  skipped ${rel} (missing or not an image)`);
      urls.set(rel, '');
      return '';
    }
    const data = fs.readFileSync(src);
    let name = `brand-${slug}-${path.basename(src).replace(/[^\w.-]/g, '_')}`;
    if (mediaGoesToDatabase()) {
      name = saveMedia(data, MIME[ext], ext);
    } else {
      for (const target of [path.join(process.cwd(), 'images', 'uploads'), path.join(process.cwd(), 'public', 'images', 'uploads')]) {
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, name), data);
      }
    }
    const url = `/api/staff-image/${name}`;
    urls.set(rel, url);
    return url;
  };

  const result = profileToBrand(profile, asset);
  const brand = saveBrand({ ...result.values, branches: result.branches, phones: result.phones, knowledge: result.knowledge });

  const program = importStarterProgram(profile, slug, asset);

  console.log(`Brand imported: ${brand.agency_name} (${brand.name_latin}) — ${brand.primary_color}`);
  console.log(`  ${result.branches.length} branches, ${result.phones.length} extra phones, ${result.knowledge.length} Sakhr answers, ${[...urls.values()].filter(Boolean).length} images`);
  if (program) console.log(`  Programme: ${program}`);
  if (profile.toConfirmWithAgency?.length) {
    console.log('  Still to confirm with the agency (left empty):');
    for (const line of profile.toConfirmWithAgency) console.log(`   - ${line}`);
  }
}

main();
