import { getSqliteDb } from '@/lib/sqlite';
import { LOGIN_ROLE_LABELS, normalizeLoginRole } from '@/lib/roles';

export type UserTableUse = {
  name: string;
  label: string;
  rows: number;
};

export type UserDatabaseUse = {
  id: string;
  label: string;
  engine: string;
  tables: UserTableUse[];
};

export type TopUserUsage = {
  id: string;
  name: string;
  username: string;
  role: string;
  roleLabel: string;
  score: number;
  percent: number;
  sessions: number;
  sessionSeconds: number;
  messages: number;
  reservations: number;
  lastActive: string | null;
  databases: UserDatabaseUse[];
};

const TABLE_LABELS: Record<string, string> = {
  sessions: 'الجلسات',
  messages: 'الرسائل',
  reservations: 'الحجوزات',
  receipts: 'الإيصالات',
  reviews: 'التقييمات',
  audit_logs: 'سجل التدقيق',
  access_requests: 'طلبات الدخول',
};

const MAIN_DB = {
  id: 'south_street.db',
  label: 'قاعدة ساوث ستريت',
  engine: 'SQLite',
};

function safeAll<T>(sql: string): T[] {
  try {
    return getSqliteDb().prepare(sql).all() as T[];
  } catch {
    return [];
  }
}

function bump(map: Map<string, number>, key: string | null | undefined, n = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + n);
}

function sessionSeconds(row: { loginTime?: string; lastActive?: string; endedAt?: string | null }) {
  const start = Date.parse(row.loginTime || '');
  const end = Date.parse(row.endedAt || row.lastActive || row.loginTime || '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / 1000);
}

const CACHE_MS = 15000;
const g = globalThis as unknown as { __ssTopUsers?: { at: number; data: TopUserUsage[] } };

export function collectTopUsers(limit = 10): TopUserUsage[] {
  const hit = g.__ssTopUsers;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data.slice(0, limit);

  const users = safeAll<{
    id: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    roleName?: string;
    code?: string;
  }>('SELECT id, name, username, email, role, roleName, code FROM users');

  if (!users.length) {
    g.__ssTopUsers = { at: Date.now(), data: [] };
    return [];
  }

  const byId = new Map(users.map((u) => [u.id, u]));
  const byEmail = new Map(
    users.filter((u) => u.email).map((u) => [String(u.email).toLowerCase(), u.id])
  );
  const byName = new Map(users.filter((u) => u.name).map((u) => [String(u.name).trim(), u.id]));
  const byCode = new Map(users.filter((u) => u.code).map((u) => [String(u.code).toUpperCase(), u.id]));

  const sessions = new Map<string, number>();
  const seconds = new Map<string, number>();
  const lastActive = new Map<string, string>();
  const messages = new Map<string, number>();
  const reservations = new Map<string, number>();
  const receipts = new Map<string, number>();
  const reviews = new Map<string, number>();
  const audits = new Map<string, number>();
  const requests = new Map<string, number>();

  for (const row of safeAll<{
    userId?: string;
    userEmail?: string;
    loginTime?: string;
    lastActive?: string;
    endedAt?: string | null;
  }>('SELECT userId, userEmail, loginTime, lastActive, endedAt FROM sessions')) {
    const id = row.userId || (row.userEmail ? byEmail.get(String(row.userEmail).toLowerCase()) : '');
    if (!id || !byId.has(id)) continue;
    bump(sessions, id);
    bump(seconds, id, sessionSeconds(row));
    const stamp = row.lastActive || row.loginTime || '';
    if (stamp && stamp > (lastActive.get(id) || '')) lastActive.set(id, stamp);
  }

  for (const row of safeAll<{ senderId?: string }>('SELECT senderId FROM messages')) {
    if (row.senderId && byId.has(row.senderId)) bump(messages, row.senderId);
  }

  for (const row of safeAll<{ customer_id?: string; customer_email?: string }>(
    'SELECT customer_id, customer_email FROM reservations'
  )) {
    const id =
      (row.customer_id && byId.has(row.customer_id) ? row.customer_id : '') ||
      (row.customer_email ? byEmail.get(String(row.customer_email).toLowerCase()) : '');
    if (id) bump(reservations, id);
  }

  for (const row of safeAll<{ pilgrimCode?: string; pilgrimName?: string }>('SELECT pilgrimCode, pilgrimName FROM receipts')) {
    const id =
      (row.pilgrimCode ? byCode.get(String(row.pilgrimCode).toUpperCase()) : '') ||
      (row.pilgrimName ? byName.get(String(row.pilgrimName).trim()) : '');
    if (id) bump(receipts, id);
  }

  for (const row of safeAll<{ reviewer_user_id?: string; reviewer_name?: string }>(
    'SELECT reviewer_user_id, reviewer_name FROM reviews'
  )) {
    const id =
      (row.reviewer_user_id && byId.has(row.reviewer_user_id) ? row.reviewer_user_id : '') ||
      (row.reviewer_name ? byName.get(String(row.reviewer_name).trim()) : '');
    if (id) bump(reviews, id);
  }

  for (const row of safeAll<{ actorName?: string }>('SELECT actorName FROM audit_logs')) {
    const id = row.actorName ? byName.get(String(row.actorName).trim()) : '';
    if (id) bump(audits, id);
  }

  for (const row of safeAll<{ userId?: string }>('SELECT userId FROM access_requests')) {
    if (row.userId && byId.has(row.userId)) bump(requests, row.userId);
  }

  const ranked = users
    .map((user) => {
      const id = user.id;
      const sess = sessions.get(id) || 0;
      const secs = seconds.get(id) || 0;
      const msg = messages.get(id) || 0;
      const resv = reservations.get(id) || 0;
      const rec = receipts.get(id) || 0;
      const rev = reviews.get(id) || 0;
      const aud = audits.get(id) || 0;
      const req = requests.get(id) || 0;
      const score =
        sess * 3 +
        secs / 60 +
        msg * 4 +
        resv * 10 +
        rec * 6 +
        rev * 5 +
        aud +
        req * 2;
      const tables: UserTableUse[] = (
        [
          ['sessions', sess],
          ['messages', msg],
          ['reservations', resv],
          ['receipts', rec],
          ['reviews', rev],
          ['audit_logs', aud],
          ['access_requests', req],
        ] as const
      )
        .filter(([, rows]) => rows > 0)
        .map(([name, rows]) => ({ name, label: TABLE_LABELS[name] || name, rows }));

      const role = normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });
      return {
        id,
        name: user.name || user.username || id,
        username: user.username || '',
        role,
        roleLabel: LOGIN_ROLE_LABELS[role],
        score: Math.round(score * 10) / 10,
        percent: 0,
        sessions: sess,
        sessionSeconds: Math.round(secs),
        messages: msg,
        reservations: resv,
        lastActive: lastActive.get(id) || null,
        databases: tables.length ? [{ ...MAIN_DB, tables }] : [],
      } satisfies TopUserUsage;
    })
    .filter((row) => row.score > 0 || row.sessions > 0)
    .sort((a, b) => b.score - a.score || b.sessions - a.sessions)
    .slice(0, limit);

  const total = ranked.reduce((sum, row) => sum + row.score, 0) || 1;
  for (const row of ranked) {
    row.percent = Math.round((row.score / total) * 1000) / 10;
  }
  g.__ssTopUsers = { at: Date.now(), data: ranked };
  return ranked;
}
