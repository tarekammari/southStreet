/**
 * The assistant's answer memory: a visitor's question that was already answered
 * is answered again from the database, without calling the AI service.
 *
 * Light on purpose (no model, no download): the question is reduced to its key
 * words — Algerian/Gulf/Fusha variants mapped to one word («شحال/بقداش/كم» → كم),
 * «ال/و» prefixes and filler words dropped, word order ignored — and two questions
 * match when their key words are the same, allowing one-letter typos. Numbers must
 * match exactly, so «عمرة 15 يوم» is never answered with «عمرة 20 يوم».
 *
 * Answers stay true to the data: each is stored with a fingerprint of the public
 * data (programs, prices, hotels, rates, guides, agency, page texts); when any of
 * it changes, older answers are no longer used. Hotel answers (dates, prices of the
 * day) expire after 12 hours, others after 3 days.
 *
 * Columns used in lookups end in «_key» so the database layer keeps them in plain
 * text (lib/db-crypto.ts); the question and the answer are encrypted at rest.
 */
import crypto from 'crypto';
import { getSqliteDb } from '@/lib/sqlite';

const SHORT_TTL_MS = 12 * 60 * 60 * 1000;
const LONG_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_ROWS = 2000;
/** Tools whose answers depend on the day (example dates, live room prices). */
const DAILY_TOOLS = new Set(['hotels_search', 'hotel_rooms', 'official_updates']);

/** Word variants → one key word. */
const SAME: Record<string, string> = {};
const group = (key: string, words: string) => words.split(' ').forEach((w) => (SAME[w] = key));
group('كم', 'كم شحال قداش بقداش بكم كام قديش بشحال');
group('سعر', 'سعر اسعار ثمن تمن سومه السومه سعره بشحال تكلفه');
group('ما', 'ما ماذا ماهو ماهي واش وش شنو ايش اش شو شنهو');
group('اين', 'اين وين فين وينكم وينه');
group('فندق', 'فندق فنادق اوتيل اوطيل hotel hotels hôtel');
group('برنامج', 'برنامج برامج عروض عرض');
group('رحله', 'رحله رحلات سفريه سفر');
group('عمره', 'عمره عمرة');
group('مرشد', 'مرشد مرشدين مرشدكم مرشده مرشدات مرشدون');
group('اريد', 'اريد حاب حابه نحب نبغي بغيت ابغي ابي عايز اود نحوس');
group('عندكم', 'عندكم لديكم تاعكم ديالكم عندك');
group('حجز', 'حجز نحجز احجز يحجز نريزرفي reservation');
group('ايميل', 'ايميل بريد email mail ميل');
group('هاتف', 'هاتف تلفون تليفون رقم نمرو portable');
group('وكاله', 'وكاله agence agency');
group('متي', 'متي وقتاش امتي');

/** Words that do not change what is asked. */
const FILLER = new Set(
  ('في من على الى الي عن هل يا او ثم مع هذا هذه ذلك تلك التي الذي انا انت انتم نحن لي لك لكم هو هي ' +
    'تاع متاع نتاع ديال انتاع بلي باش راهو راهي راكم كاين كاينه فضلك سمحت عافاك خويا اختي السلام عليكم ' +
    'مرحبا اهلا سلام بربي please svp لو من فضلكم شكرا يعطيك الصحه بزاف شويه ممكن نقدر تقدر نعرف عرفني قولي قلي اعطيني').split(' ')
);

/** «الفنادق» → «فنادق», «وبرامج» → «برامج»; very short words are left alone. */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && (w.startsWith('وال') || w.startsWith('بال') || w.startsWith('فال') || w.startsWith('كال'))) w = w.slice(3);
  else if (w.length > 4 && w.startsWith('لل')) w = w.slice(2);
  else if (w.length > 3 && w.startsWith('ال')) w = w.slice(2);
  else if (w.length > 4 && w.startsWith('و') && !SAME[w]) w = w.slice(1);
  return w;
}

/** A question → its sorted key words ([] when nothing is left, e.g. a greeting). */
export function questionWords(text: string): string[] {
  const plain = String(text || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const words = new Set<string>();
  for (const raw of plain.split(' ')) {
    if (!raw || FILLER.has(raw)) continue;
    const w = SAME[raw] || SAME[stem(raw)] || stem(raw);
    if (!FILLER.has(w)) words.add(w);
  }
  return [...words].sort();
}

function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b) || Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Same key words (one-letter typos allowed), nothing more and nothing less. */
export function sameQuestion(a: string[], b: string[]): boolean {
  if (!a.length || a.length !== b.length) return false;
  const left = [...b];
  for (const w of a) {
    const k = left.findIndex((x) => oneEditApart(w, x));
    if (k < 0) return false;
    left.splice(k, 1);
  }
  return true;
}

/* ------------------------------ data fingerprint ------------------------------ */

const DATA_TABLES = ['packages', 'package_prices', 'hotels', 'hotel_rates', 'hotel_rooms', 'morshids', 'agency_settings', 'page_content', 'ai_knowledge', 'seasons'];
let fingerprint = '';
let fingerprintAt = 0;

/** A short hash of the public data; recomputed at most once a minute. */
function dataFingerprint(): string {
  if (fingerprint && Date.now() - fingerprintAt < 60_000) return fingerprint;
  const db = getSqliteDb();
  const hash = crypto.createHash('sha1');
  for (const table of DATA_TABLES) {
    try {
      const { n } = db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number };
      hash.update(`${table}:${n};`);
      if (n <= 20000) for (const row of db.prepare(`SELECT * FROM ${table}`).iterate()) hash.update(JSON.stringify(row));
    } catch {
      hash.update(`${table}:-;`);
    }
  }
  fingerprint = hash.digest('hex').slice(0, 16);
  fingerprintAt = Date.now();
  return fingerprint;
}

/* ----------------------------------- store ----------------------------------- */

let ready = false;
function table() {
  const db = getSqliteDb();
  if (!ready) {
    db.exec(`CREATE TABLE IF NOT EXISTS sakhr_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice INTEGER NOT NULL,
      words_key TEXT NOT NULL,
      question TEXT NOT NULL,
      reply TEXT NOT NULL,
      version_key TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sakhr_memory_lookup ON sakhr_memory(version_key, voice, expires_at);`);
    ready = true;
  }
  return db;
}

/** A stored answer to the same question, or null. */
export function recall<T>(question: string, voice: boolean): T | null {
  try {
    const words = questionWords(question);
    if (!words.length) return null;
    const db = table();
    const rows = db
      .prepare('SELECT id, words_key, reply FROM sakhr_memory WHERE version_key = ? AND voice = ? AND expires_at > ? ORDER BY hits DESC LIMIT 800')
      .all(dataFingerprint(), voice ? 1 : 0, Date.now()) as { id: number; words_key: string; reply: string }[];
    const hit = rows.find((r) => sameQuestion(words, r.words_key.split(' ')));
    if (!hit) return null;
    db.prepare('UPDATE sakhr_memory SET hits = hits + 1 WHERE id = ?').run(hit.id);
    return JSON.parse(hit.reply) as T;
  } catch {
    return null;
  }
}

/** Keeps an answer for the next visitor who asks the same thing. */
export function remember(question: string, voice: boolean, reply: unknown, tools: string[]): void {
  try {
    const words = questionWords(question);
    if (!words.length) return;
    const db = table();
    const now = Date.now();
    const ttl = tools.some((t) => DAILY_TOOLS.has(t)) ? SHORT_TTL_MS : LONG_TTL_MS;
    db.prepare('INSERT INTO sakhr_memory (voice, words_key, question, reply, version_key, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(voice ? 1 : 0, words.join(' '), question.slice(0, 500), JSON.stringify(reply), dataFingerprint(), now + ttl, now);
    // Housekeeping now and then: drop expired and outdated answers, keep the table small.
    if (Math.random() < 0.05) {
      db.prepare('DELETE FROM sakhr_memory WHERE expires_at < ? OR version_key <> ?').run(now, dataFingerprint());
      db.prepare(`DELETE FROM sakhr_memory WHERE id NOT IN (SELECT id FROM sakhr_memory ORDER BY hits DESC, id DESC LIMIT ${MAX_ROWS})`).run();
    }
  } catch {
    /* the memory is only a shortcut: never fail the chat because of it */
  }
}
