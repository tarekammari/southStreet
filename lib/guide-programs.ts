import { getSqliteDb } from '@/lib/sqlite';
import { isTripOver } from '@/lib/booking-catalog';

/**
 * The programmes a guide accompanies. A programme has one guide
 * (packages.morshid_id / morshid_name); the guide's workspace and the trip pages
 * read it from there. Finished programmes are listed only when this guide was on
 * them, and are never changed.
 */

type Row = { package_id: string; name: string; start_date?: string; end_date?: string; duration_days?: number; status?: string; morshid_id?: string; morshid_name?: string };

export type GuideProgram = {
  package_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  finished: boolean;
  assigned: boolean;
  other_guide: string | null;
};

export function listGuidePrograms(guideId: string): { guide?: { morshid_id: string; name: string }; programs: GuideProgram[] } {
  const db = getSqliteDb();
  const guide = db.prepare('SELECT morshid_id, name FROM morshids WHERE morshid_id = ?').get(guideId) as { morshid_id: string; name: string } | undefined;
  const rows = db.prepare('SELECT package_id, name, start_date, end_date, duration_days, status, morshid_id, morshid_name FROM packages').all() as Row[];
  const programs = rows
    .map((p) => {
      const over = isTripOver({ program: { start_date: p.start_date, end_date: p.end_date, duration_days: p.duration_days } });
      const mine = String(p.morshid_id || '') === guideId;
      return {
        package_id: p.package_id,
        name: p.name,
        start_date: p.start_date || null,
        end_date: p.end_date || null,
        status: p.status || null,
        finished: over,
        assigned: mine,
        other_guide: !mine && p.morshid_id ? p.morshid_name || 'مرشد آخر' : null,
      };
    })
    .filter((p) => !p.finished || p.assigned)
    .sort((a, b) => String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')));
  return { guide, programs };
}

/** This guide accompanies exactly these (not finished) programmes. Returns the names added / removed. */
export function setGuidePrograms(guideId: string, packageIds: string[]): { added: string[]; removed: string[] } | null {
  const { guide, programs } = listGuidePrograms(guideId);
  if (!guide) return null;
  const wanted = new Set(packageIds.map(String));
  const db = getSqliteDb();
  const set = db.prepare('UPDATE packages SET morshid_id = ?, morshid_name = ? WHERE package_id = ?');
  const clear = db.prepare('UPDATE packages SET morshid_id = NULL, morshid_name = NULL WHERE package_id = ?');
  const added: string[] = [];
  const removed: string[] = [];
  db.transaction(() => {
    for (const p of programs) {
      if (p.finished) continue; // history stays as it was
      if (wanted.has(p.package_id) && !p.assigned) {
        set.run(guide.morshid_id, guide.name, p.package_id);
        added.push(p.name);
      } else if (!wanted.has(p.package_id) && p.assigned) {
        clear.run(p.package_id);
        removed.push(p.name);
      }
    }
  })();
  return { added, removed };
}
