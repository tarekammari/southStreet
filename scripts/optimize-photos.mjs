#!/usr/bin/env node
/**
 * Light versions of the destination and hotel photos.
 *
 *   node scripts/optimize-photos.mjs [folder-with-new-photos]
 *
 * New photos (any format) in the optional folder are copied in first:
 * `city-*` / `dest-*` go to public/images/destinations, the rest to
 * public/images/hotels. Then, for every photo in those two folders:
 *   name.jpg      re-encoded (progressive mozjpeg, max 1280 px) — the paths
 *                 stored in the database keep working
 *   name.webp     same size, WebP — used by the pages
 *   name-sm.webp  640 px wide — cards and thumbnails
 * Already-processed photos are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const DIRS = ['public/images/destinations', 'public/images/hotels'].map((d) => path.join(ROOT, d));
const MAX = 1280;
const SMALL = 640;

const newer = (out, src) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)}KB`;

async function importFrom(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const name = f.replace(/\.[^.]+$/, '');
    const target = path.join(/^(city|dest)-/.test(name) ? DIRS[0] : DIRS[1], `${name}.jpg`);
    await sharp(path.join(dir, f)).rotate().resize({ width: MAX, withoutEnlargement: true }).jpeg({ quality: 74, mozjpeg: true, progressive: true }).toFile(target);
    console.log('added', path.relative(ROOT, target), kb(target));
  }
}

async function lighten(file) {
  const base = file.replace(/\.jpg$/i, '');
  const webp = `${base}.webp`;
  const small = `${base}-sm.webp`;
  if (newer(webp, file) && newer(small, file)) return;
  const input = fs.readFileSync(file);
  const meta = await sharp(input).metadata();
  if ((meta.width || 0) > MAX || fs.statSync(file).size > 240 * 1024) {
    const jpg = await sharp(input).rotate().resize({ width: MAX, withoutEnlargement: true }).jpeg({ quality: 74, mozjpeg: true, progressive: true }).toBuffer();
    fs.writeFileSync(file, jpg);
  }
  await sharp(input).rotate().resize({ width: MAX, withoutEnlargement: true }).webp({ quality: 70, effort: 5 }).toFile(webp);
  await sharp(input).rotate().resize({ width: SMALL, withoutEnlargement: true }).webp({ quality: 66, effort: 5 }).toFile(small);
  console.log(path.relative(ROOT, file), kb(file), '·', kb(webp), '·', kb(small));
}

const extra = process.argv[2];
if (extra) await importFrom(path.resolve(extra));
for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir).sort()) {
    if (/\.jpg$/i.test(f)) await lighten(path.join(dir, f));
  }
}
