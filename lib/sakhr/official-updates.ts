import { getSqliteDb } from '@/lib/sqlite';
import { normalizeQuestion } from '@/lib/sakhr/capacity';
import { trustedWebSearch } from '@/lib/sakhr/trusted-search';

/**
 * Official Hajj / Umrah updates, collected from trusted official sites every
 * 3 days (PM2 cron "south-street-official-updates", 02:00) and stored, so Sakhr
 * answers these questions instantly and for free instead of searching each time.
 *
 * Each topic is one trusted search (lib/sakhr/trusted-search.ts: official sites
 * only, answer written from their text, sources kept). A failed or empty search
 * never replaces good stored information: it is kept and marked as not refreshed.
 *
 *   npm run official:refresh      refresh all topics now
 *   npm run official:list         show what is stored
 */

type Topic = { key: string; title: string; question: () => string; words: string[] };

/** Current Hijri year, and the Hijri / Gregorian year of the next Hajj. */
function seasons() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/[^\d]/g, '') || 0);
  const hy = num('year');
  const after = num('month') === 12 && num('day') > 13; // this year's Hajj is over
  const hajjHijri = after ? hy + 1 : hy;
  const hajjGreg = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return { hy, hajjHijri, hajjGreg };
}

export const OFFICIAL_TOPICS: Topic[] = [
  {
    key: 'umrah-season',
    title: 'موسم العمرة: المستجدات والمواعيد والتعليمات',
    question: () => `مستجدات موسم العمرة ${seasons().hy} هـ ومواعيده وتعليماته الرسمية على منصة نسك ووزارة الحج والعمرة`,
    words: ['موسم', 'العمره', 'مواعيد', 'مستجدات', 'نسك', 'تعليمات', 'season'],
  },
  {
    key: 'umrah-visa',
    title: 'تأشيرة العمرة وتصريح العمرة',
    question: () => 'شروط تأشيرة العمرة الحالية ومدة صلاحيتها وطريقة حجز تصريح العمرة',
    words: ['تاشيره', 'فيزا', 'تصريح', 'visa', 'permit', 'صلاحيه'],
  },
  {
    key: 'health',
    title: 'الاشتراطات الصحية واللقاحات',
    question: () => 'الاشتراطات الصحية واللقاحات المطلوبة للعمرة والحج لهذا الموسم حسب وزارة الصحة السعودية',
    words: ['لقاح', 'لقاحات', 'صحيه', 'صحه', 'تطعيم', 'vaccine', 'health'],
  },
  {
    key: 'hajj-saudi',
    title: 'الحج: تعليمات المملكة العربية السعودية',
    question: () => `مستجدات وتعليمات حج ${seasons().hajjHijri} هـ (${seasons().hajjGreg}) من وزارة الحج والعمرة السعودية`,
    words: ['حج', 'الحج', 'hajj', 'تعليمات', 'مشاعر'],
  },
  {
    key: 'hajj-algeria',
    title: 'الحج للجزائريين: الديوان الوطني للحج والعمرة',
    question: () => `مستجدات حج ${seasons().hajjGreg} للجزائريين من الديوان الوطني للحج والعمرة ووزارة الشؤون الدينية: التسجيل والقرعة والتكلفة`,
    words: ['الجزائر', 'جزائري', 'الديوان', 'قرعه', 'تسجيل', 'onpo', 'تكلفه'],
  },
  {
    key: 'flights',
    title: 'رحلات الحج والعمرة الجوية',
    question: () => 'برنامج رحلات الحج والعمرة الجوية للخطوط الجوية الجزائرية وإعلانات الطيران المدني السعودي للموسم الحالي',
    words: ['طيران', 'رحلات', 'جويه', 'مطار', 'الخطوط', 'flight', 'airline'],
  },
  {
    key: 'haramain',
    title: 'الحرمان الشريفان: الخدمات وزيارة الروضة',
    question: () => 'مواعيد وخدمات المسجد الحرام والمسجد النبوي وحجز زيارة الروضة الشريفة',
    words: ['الحرم', 'الروضه', 'المسجد', 'النبوي', 'زياره', 'rawdah'],
  },
];

export type OfficialUpdate = {
  key: string;
  title: string;
  answer: string;
  sources: { title: string; url: string; publisher: string }[];
  status: 'fresh' | 'not_refreshed' | 'none';
  fetchedAt: string | null;
  changedAt: string | null;
};

let ready = false;
function db() {
  const d = getSqliteDb();
  if (!ready) {
    d.exec(
      'CREATE TABLE IF NOT EXISTS official_updates (topic_key TEXT PRIMARY KEY, title TEXT, answer TEXT, sources TEXT, status_type TEXT, fetched_ts INTEGER, changed_ts INTEGER, tried_ts INTEGER)'
    );
    ready = true;
  }
  return d;
}

function rowToUpdate(r: any): OfficialUpdate {
  let sources: OfficialUpdate['sources'] = [];
  try {
    sources = JSON.parse(r.sources || '[]');
  } catch {
    /* keep empty */
  }
  return {
    key: r.topic_key,
    title: r.title,
    answer: r.answer || '',
    sources,
    status: r.status_type || 'none',
    fetchedAt: r.fetched_ts ? new Date(Number(r.fetched_ts)).toISOString() : null,
    changedAt: r.changed_ts ? new Date(Number(r.changed_ts)).toISOString() : null,
  };
}

export function listOfficialUpdates(): OfficialUpdate[] {
  const rows = db().prepare('SELECT * FROM official_updates').all() as any[];
  const byKey = new Map(rows.map((r) => [r.topic_key, rowToUpdate(r)]));
  return OFFICIAL_TOPICS.map((t) => byKey.get(t.key) || { key: t.key, title: t.title, answer: '', sources: [], status: 'none', fetchedAt: null, changedAt: null });
}

/** Topics that match a question (by keywords); all of them when nothing matches. */
export function findOfficialUpdates(question: string): OfficialUpdate[] {
  const all = listOfficialUpdates().filter((u) => u.answer);
  const q = normalizeQuestion(question || '');
  if (!q) return all;
  const scored = OFFICIAL_TOPICS.map((t) => ({ key: t.key, score: t.words.filter((w) => q.includes(normalizeQuestion(w))).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return all;
  const keys = new Set(scored.slice(0, 2).map((x) => x.key));
  return all.filter((u) => keys.has(u.key));
}

/** True when nothing is stored yet or the last refresh attempt is about 3 days old. */
export function officialUpdatesDue(maxAgeHours = 70): boolean {
  const r = db().prepare('SELECT MIN(tried_ts) AS oldest, COUNT(*) AS n FROM official_updates').get() as { oldest?: number; n: number };
  if (!r || r.n < OFFICIAL_TOPICS.length || !r.oldest) return true;
  return Date.now() - Number(r.oldest) > maxAgeHours * 3_600_000;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Refreshes every topic, one at a time with a pause (free per-minute limits).
 * Stops early when the AI daily limit is reached; stored information is kept.
 */
export async function refreshOfficialUpdates(opts: { gapMs?: number; log?: (line: string) => void } = {}) {
  const gap = opts.gapMs ?? 75_000;
  const log = opts.log || (() => undefined);
  const d = db();
  const summary = { fresh: 0, changed: 0, kept: 0, failed: 0 };
  for (const [i, topic] of OFFICIAL_TOPICS.entries()) {
    if (i) await sleep(gap);
    const now = Date.now();
    const prev = d.prepare('SELECT * FROM official_updates WHERE topic_key = ?').get(topic.key) as any;
    try {
      const r = await trustedWebSearch(topic.question(), { scheduled: true });
      if (r.found) {
        const changed = !prev || (prev.answer || '') !== r.answer;
        const changedTs = changed ? now : Number(prev?.changed_ts) || now;
        // Plain statements: the encryption layer maps each value to its column.
        if (prev) {
          d.prepare('UPDATE official_updates SET title = ?, answer = ?, sources = ?, status_type = ?, fetched_ts = ?, changed_ts = ?, tried_ts = ? WHERE topic_key = ?').run(
            topic.title, r.answer, JSON.stringify(r.sources), 'fresh', now, changedTs, now, topic.key
          );
        } else {
          d.prepare('INSERT INTO official_updates (topic_key, title, answer, sources, status_type, fetched_ts, changed_ts, tried_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            topic.key, topic.title, r.answer, JSON.stringify(r.sources), 'fresh', now, changedTs, now
          );
        }
        summary.fresh += 1;
        if (changed) summary.changed += 1;
        log(`✓ ${topic.key}: ${changed ? 'updated' : 'no change'} (${r.sources.length} official sources)`);
      } else {
        // Nothing new from the official sites: keep what we had.
        if (prev) d.prepare('UPDATE official_updates SET status_type = ?, tried_ts = ? WHERE topic_key = ?').run('not_refreshed', now, topic.key);
        summary.kept += 1;
        log(`– ${topic.key}: not found this time (${r.reason})${prev ? ', previous kept' : ''}`);
      }
    } catch (error) {
      summary.failed += 1;
      const status = (error as { status?: number })?.status;
      log(`✗ ${topic.key}: ${status || ''} ${String((error as Error)?.message || error).slice(0, 120)}`);
      if (prev) d.prepare('UPDATE official_updates SET status_type = ?, tried_ts = ? WHERE topic_key = ?').run('not_refreshed', now, topic.key);
      // Daily AI limit: the rest would fail too; try again next run.
      if (status === 429 && /per day|TPD|daily/i.test(String((error as Error)?.message))) {
        log('Daily AI limit reached: stopping; the remaining topics keep their stored information.');
        break;
      }
    }
  }
  return summary;
}
