/**
 * Loads an agency profile folder into «هوية الوكالة» — run on the server, in
 * the agency's app folder:
 *
 *   npm run brand:import -- deploy/agencies/rhtours
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

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

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

  console.log(`Brand imported: ${brand.agency_name} (${brand.name_latin}) — ${brand.primary_color}`);
  console.log(`  ${result.branches.length} branches, ${result.phones.length} extra phones, ${result.knowledge.length} Sakhr answers, ${[...urls.values()].filter(Boolean).length} images`);
  if (profile.toConfirmWithAgency?.length) {
    console.log('  Still to confirm with the agency (left empty):');
    for (const line of profile.toConfirmWithAgency) console.log(`   - ${line}`);
  }
}

main();
