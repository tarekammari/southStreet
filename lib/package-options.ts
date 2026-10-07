import { BOOKING_EXTRAS, ROOM_LABELS } from '@/lib/booking-catalog';
import type { BookingExtra } from '@/types';

export const DEFAULT_ROOM_PRICES: { room_type: string; amount: number }[] = [
  { room_type: 'QUAD', amount: 215000 },
  { room_type: 'TRIPLE', amount: 245000 },
  { room_type: 'DOUBLE', amount: 285000 },
  { room_type: 'SINGLE', amount: 360000 },
];

export type PackageAnnex = BookingExtra & { enabled: boolean };

export function defaultAnnexes(): PackageAnnex[] {
  return BOOKING_EXTRAS.map((item) => ({ ...item, enabled: true }));
}

export function parseAnnexes(raw: unknown): PackageAnnex[] {
  const base = defaultAnnexes();
  if (!raw) return base;
  let rows: unknown = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return base;
    try {
      rows = JSON.parse(text);
    } catch {
      return base;
    }
  }
  if (!Array.isArray(rows) || rows.length === 0) return base;
  const byId = new Map(base.map((item) => [item.id, item]));
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    const current = byId.get(id) || {
      id,
      title: id,
      detail: '',
      price: 0,
      enabled: true,
    };
    byId.set(id, {
      ...current,
      title: String((row as { title?: string }).title || current.title),
      detail: String((row as { detail?: string }).detail || current.detail),
      price: Math.max(0, Number((row as { price?: number }).price) || 0),
      enabled: (row as { enabled?: boolean }).enabled !== false,
    });
  }
  return [...byId.values()];
}

export function enabledAnnexes(raw: unknown): BookingExtra[] {
  return parseAnnexes(raw)
    .filter((item) => item.enabled && item.price >= 0)
    .map(({ id, title, detail, price }) => ({ id, title, detail, price }));
}

export function roomLabel(type: string): string {
  return ROOM_LABELS[type] || type;
}

/** Insert the four room prices when a programme was saved without any, and store default annexes. */
export function ensurePackageRoomPrices(db: { prepare: (sql: string) => any; exec?: (sql: string) => void }, packageId: string) {
  const id = String(packageId || '').trim();
  if (!id) return;
  try {
    const cols = db.prepare('PRAGMA table_info(packages)').all() as { name: string }[];
    if (cols.length && !cols.some((col) => col.name === 'annex_options') && db.exec) {
      db.exec('ALTER TABLE packages ADD COLUMN annex_options TEXT');
    }
  } catch {
    /* column already present */
  }
  const existing = db.prepare('SELECT price_id FROM package_prices WHERE package_id = ?').all(id) as { price_id?: string }[];
  if (existing.length === 0) {
    const insert = db.prepare(`
      INSERT INTO package_prices (price_id, package_id, room_type, traveler_type, currency, amount)
      VALUES (?, ?, ?, 'ADULT', 'DZD', ?)
    `);
    for (const room of DEFAULT_ROOM_PRICES) {
      insert.run(`prc_${id}_${room.room_type.toLowerCase()}`, id, room.room_type, room.amount);
    }
  }
  const row = db.prepare('SELECT annex_options FROM packages WHERE package_id = ?').get(id) as { annex_options?: string | null } | undefined;
  if (row && (row.annex_options == null || String(row.annex_options).trim() === '')) {
    db.prepare('UPDATE packages SET annex_options = ? WHERE package_id = ?').run(JSON.stringify(defaultAnnexes()), id);
  }
}
