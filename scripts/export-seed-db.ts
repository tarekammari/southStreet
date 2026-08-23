#!/usr/bin/env npx tsx
/**
 * Copy your local south_street.db to data/south_street.seed.db
 * so Vercel can bootstrap /tmp from your real data on first cold start.
 *
 * Usage: npx tsx scripts/export-seed-db.ts
 */
import fs from 'fs';
import path from 'path';

const src = path.join(process.cwd(), 'south_street.db');
const destDir = path.join(process.cwd(), 'data');
const dest = path.join(destDir, 'south_street.seed.db');

if (!fs.existsSync(src)) {
  console.error('No south_street.db found. Run the app locally first (npm run dev).');
  process.exit(1);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Seed database written to ${dest}`);
console.log('Commit data/south_street.seed.db if you want Vercel to start with this data.');
