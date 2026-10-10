/**
 * Extra columns of a staff profile (morshids): bio, skills, qualifications and
 * the home-page choice. They are added on first use instead of in the start-up
 * setup (lib/sqlite.ts), so adding them does not re-run the whole setup on Turso.
 */
import type Database from 'better-sqlite3';
import { toList } from './json-list';

const EXTRA_COLUMNS: [string, string][] = [
  ['bio', 'TEXT'],
  ['skills', 'TEXT'],
  ['qualifications', 'TEXT'],
  ['show_on_home', 'INTEGER DEFAULT 0'],
  ['home_order', 'INTEGER DEFAULT 0'],
];

let checked = false;
export function ensureStaffProfileColumns(db: Database.Database) {
  if (checked) return;
  const have = new Set((db.prepare('PRAGMA table_info(morshids)').all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of EXTRA_COLUMNS) {
    if (!have.has(name)) db.exec(`ALTER TABLE morshids ADD COLUMN ${name} ${type}`);
  }
  checked = true;
}

/** "1" / 1 / true / "نعم" → 1. */
export function toFlag(value: unknown): 0 | 1 {
  if (value === true || value === 1) return 1;
  const s = String(value ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'نعم' ? 1 : 0;
}

/** Fields shared by the public catalogue and the admin views. */
export function staffExtras(row: Record<string, unknown>) {
  return {
    bio: String(row.bio || ''),
    skills: toList(row.skills),
    qualifications: toList(row.qualifications),
    show_on_home: toFlag(row.show_on_home) === 1,
    home_order: Number(row.home_order) || 0,
  };
}
