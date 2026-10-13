import { getSqliteDb } from '@/lib/sqlite';

/**
 * Keeps Sakhr usable when many people chat at once on free AI quotas:
 *  - a fair queue: one message per user at a time, a few AI calls at once for
 *    everybody, the rest wait their turn instead of failing;
 *  - a short-lived cache of visitors' common first questions (no AI call);
 *  - one metrics row per answer (no message text, no personal data) so the real
 *    capacity can be measured: npm run sakhr:stats.
 */

/* ------------------------------ fair queue ------------------------------ */

export class SakhrBusyError extends Error {
  constructor(public readonly reason: 'same-user' | 'queue-full') {
    super(reason);
  }
}

const MAX_CONCURRENT = Math.max(1, Number(process.env.SAKHR_MAX_CONCURRENT) || 4);
const MAX_WAIT_MS = 25_000;

const g = globalThis as unknown as { __ssSakhrQueue?: { active: number; waiting: Array<() => void>; users: Set<string> } };
const q = (g.__ssSakhrQueue ||= { active: 0, waiting: [], users: new Set() });

/** Runs fn when a slot is free. The same user cannot run two messages at once. */
export async function withSlot<T>(userKey: string, fn: () => Promise<T>): Promise<T> {
  if (q.users.has(userKey)) throw new SakhrBusyError('same-user');
  q.users.add(userKey);
  try {
    if (q.active >= MAX_CONCURRENT) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          const i = q.waiting.indexOf(go);
          if (i > -1) q.waiting.splice(i, 1);
          reject(new SakhrBusyError('queue-full'));
        }, MAX_WAIT_MS);
        function go() {
          clearTimeout(timer);
          resolve();
        }
        q.waiting.push(go);
      });
    }
    q.active += 1;
    try {
      return await fn();
    } finally {
      q.active -= 1;
      q.waiting.shift()?.();
    }
  } finally {
    q.users.delete(userKey);
  }
}

/* --------------------------- common answers cache --------------------------- */

/** Only tools whose answers are the same for every visitor make a reply cacheable. */
export const PUBLIC_TOOLS = new Set(['search_programs', 'list_hotels', 'agency_knowledge', 'agency_team']);

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;
type Cached = { at: number; value: unknown };
const gc = globalThis as unknown as { __ssSakhrCache?: Map<string, Cached> };
const cache = (gc.__ssSakhrCache ||= new Map());

/** Same question written differently (diacritics, alef forms, punctuation) → same key. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // harakat, tatweel
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
}

/* -------------------------------- metrics -------------------------------- */

export type SakhrMetric = {
  role: string;
  provider: string;
  ms: number;
  tokens: number;
  rounds: number;
  tools: string[];
  cached: boolean;
  ok: boolean;
};

let metricsReady = false;
function metricsDb() {
  const db = getSqliteDb() as any;
  // Raw statements: these rows hold no personal data, only numbers and labels
  // (text columns end in _type / _key so the boot-time encryption pass leaves them readable).
  const prepare = (db.__rawPrepare as ((sql: string) => any) | undefined) || db.prepare.bind(db);
  if (!metricsReady) {
    prepare(
      'CREATE TABLE IF NOT EXISTS sakhr_metrics (ts INTEGER NOT NULL, role_type TEXT, provider_key TEXT, ms INTEGER, tokens INTEGER, rounds INTEGER, tools_key TEXT, cached INTEGER, ok INTEGER)'
    ).run();
    prepare('CREATE INDEX IF NOT EXISTS sakhr_metrics_ts ON sakhr_metrics (ts)').run();
    metricsReady = true;
  }
  return { prepare };
}

export function recordMetric(m: SakhrMetric): void {
  try {
    const d = metricsDb();
    d.prepare('INSERT INTO sakhr_metrics VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      Date.now(),
      m.role,
      m.provider,
      Math.round(m.ms),
      m.tokens,
      m.rounds,
      m.tools.join(','),
      m.cached ? 1 : 0,
      m.ok ? 1 : 0
    );
    // Keep 30 days.
    if (Math.random() < 0.02) d.prepare('DELETE FROM sakhr_metrics WHERE ts < ?').run(Date.now() - 30 * 86_400_000);
  } catch {
    /* metrics must never break a chat */
  }
}

export type SakhrStats = {
  hours: number;
  answers: number;
  failed: number;
  cached: number;
  avgMs: number;
  p95Ms: number;
  tokens: number;
  byProvider: Record<string, number>;
  busiestMinute: number;
};

export function readStats(hours = 24): SakhrStats {
  const rows = metricsDb()
    .prepare('SELECT ts, provider_key AS provider, ms, tokens, cached, ok FROM sakhr_metrics WHERE ts > ?')
    .all(Date.now() - hours * 3_600_000) as { ts: number; provider: string; ms: number; tokens: number; cached: number; ok: number }[];
  const answered = rows.filter((r) => r.ok);
  const live = answered.filter((r) => !r.cached).map((r) => r.ms).sort((a, b) => a - b);
  const perMinute = new Map<number, number>();
  for (const r of rows) perMinute.set(Math.floor(r.ts / 60_000), (perMinute.get(Math.floor(r.ts / 60_000)) || 0) + 1);
  const byProvider: Record<string, number> = {};
  for (const r of answered) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
  return {
    hours,
    answers: answered.length,
    failed: rows.length - answered.length,
    cached: answered.filter((r) => r.cached).length,
    avgMs: live.length ? Math.round(live.reduce((a, b) => a + b, 0) / live.length) : 0,
    p95Ms: live.length ? live[Math.min(live.length - 1, Math.floor(live.length * 0.95))] : 0,
    tokens: rows.reduce((a, r) => a + (r.tokens || 0), 0),
    byProvider,
    busiestMinute: Math.max(0, ...perMinute.values()),
  };
}
