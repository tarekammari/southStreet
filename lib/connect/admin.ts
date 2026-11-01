/**
 * What the Super Admin's dashboard (/connect/admin) sees: activity, never
 * content. Counts of messages and calls, who is online, live calls, devices,
 * the rules in force, and the audit log of the dashboard's own actions.
 * Private one-to-one conversations are never read here.
 */
import { getSqliteDb } from '../sqlite';
import { activeUsers, getCall, isOnline, lastSeen, pushTargets, type ConnectCall } from './store';
import { allControls, settings } from './policy';
import { allGroups } from './groups';

const DAY = 86_400_000;

function rows<T = any>(sql: string, ...args: unknown[]): T[] {
  try {
    return getSqliteDb().prepare(sql).all(...args) as T[];
  } catch {
    return []; // a Connect table not created yet
  }
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calls ringing or in progress now, with both names. */
export function liveCalls() {
  const users = new Map(activeUsers().map((u) => [u.id, u]));
  return rows("SELECT call_id FROM connect_calls WHERE state_type IN ('ringing','active')")
    .map((r) => getCall(String(r.call_id)))
    .filter((c): c is ConnectCall => Boolean(c) && (c!.state === 'ringing' || c!.state === 'active'))
    .map((c) => ({
      id: c.id,
      state: c.state,
      caller: users.get(c.callerId)?.name || '—',
      callee: users.get(c.calleeId)?.name || '—',
      startedTs: c.createdTs,
      answeredTs: c.answeredTs || null,
      ringing: Boolean(c.ringingTs),
      signed: Boolean(c.offerSig && (c.state === 'ringing' || c.answerSig)),
    }));
}

export function overview() {
  const users = activeUsers();
  const today = startOfToday();
  const msgs = rows<{ kind_type: string; chatId: string }>("SELECT kind_type, chatId FROM messages WHERE ts >= ? AND (chatId LIKE 'dm:%' OR chatId LIKE 'grp:%')", today);
  const calls = rows<any>('SELECT state_type, ringing_ts, answered_ts, ended_ts FROM connect_calls WHERE created_ts >= ?', today);
  const answered = calls.filter((c) => c.answered_ts);
  const talked = answered.map((c) => ((Number(c.ended_ts) || Date.now()) - Number(c.answered_ts)) / 1000);
  const devices = rows<{ subscription: string }>('SELECT subscription FROM connect_push');
  const byRole: Record<string, number> = {};
  for (const u of users) byRole[u.roleLabel || u.role] = (byRole[u.roleLabel || u.role] || 0) + 1;
  const controls = allControls();
  // Last 7 days, one bar per day: messages and calls.
  const week = Array.from({ length: 7 }, (_, i) => {
    const from = today - (6 - i) * DAY;
    const to = from + DAY;
    const d = new Date(from); // the server's local day (toISOString would show UTC: a day early east of Greenwich)
    return {
      day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      messages: rows<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE ts >= ? AND ts < ? AND kind_type != 'call' AND (chatId LIKE 'dm:%' OR chatId LIKE 'grp:%')", from, to)[0]?.n || 0,
      calls: rows<{ n: number }>('SELECT COUNT(*) AS n FROM connect_calls WHERE created_ts >= ? AND created_ts < ?', from, to)[0]?.n || 0,
    };
  });
  return {
    users: { total: users.length, online: users.filter((u) => isOnline(u.id)).length, byRole, suspended: [...controls.values()].filter((c) => c.suspended).length, callsBlocked: [...controls.values()].filter((c) => c.callsBlocked).length },
    today: {
      messages: msgs.filter((m) => m.kind_type !== 'call').length,
      groupMessages: msgs.filter((m) => m.kind_type !== 'call' && m.chatId.startsWith('grp:')).length,
      voiceNotes: msgs.filter((m) => m.kind_type === 'voice').length,
      calls: calls.length,
      answered: answered.length,
      missed: calls.filter((c) => c.state_type === 'missed' && c.ringing_ts).length,
      unreachable: calls.filter((c) => c.state_type === 'missed' && !c.ringing_ts).length,
      declined: calls.filter((c) => c.state_type === 'declined').length,
      avgCallSeconds: talked.length ? Math.round(talked.reduce((a, b) => a + b, 0) / talked.length) : 0,
    },
    week,
    live: liveCalls(),
    groups: allGroups().length,
    devices: { android: devices.filter((d) => d.subscription.includes('"fcm"')).length, web: devices.filter((d) => !d.subscription.includes('"fcm"')).length },
    relay: Boolean((process.env.TURN_URLS || '').trim()),
    settings: settings(),
  };
}

/** Everyone, with presence, devices, 7-day activity and the rules on them. */
export function people() {
  const since = Date.now() - 7 * DAY;
  const sent = new Map(rows<{ senderId: string; n: number }>("SELECT senderId, COUNT(*) AS n FROM messages WHERE ts >= ? AND kind_type != 'call' AND (chatId LIKE 'dm:%' OR chatId LIKE 'grp:%') GROUP BY senderId", since).map((r) => [String(r.senderId), Number(r.n)]));
  const callCount = new Map<string, number>();
  for (const c of rows<{ caller_id: string; callee_id: string }>('SELECT caller_id, callee_id FROM connect_calls WHERE created_ts >= ?', since)) {
    for (const id of [c.caller_id, c.callee_id]) callCount.set(String(id), (callCount.get(String(id)) || 0) + 1);
  }
  const controls = allControls();
  return activeUsers()
    .map((u) => {
      const devices = pushTargets(u.id).map((t) => (t.subscription?.fcm ? 'android' : 'web'));
      const c = controls.get(u.id);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        roleLabel: u.roleLabel,
        photo: u.photo,
        online: isOnline(u.id),
        lastSeen: lastSeen(u.id),
        devices: { android: devices.filter((d) => d === 'android').length, web: devices.filter((d) => d === 'web').length },
        messages7d: sent.get(u.id) || 0,
        calls7d: callCount.get(u.id) || 0,
        suspended: Boolean(c?.suspended),
        callsBlocked: Boolean(c?.callsBlocked),
        reason: c?.reason || '',
        untilTs: c?.untilTs || null,
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeen - a.lastSeen || a.name.localeCompare(b.name, 'ar'));
}

/** The dashboard's own actions (who did what, when). */
export function auditLog(limit = 150) {
  // The log's text is encrypted at rest, so SQL cannot search it: read the latest rows
  // (decrypted by the database layer) and keep the dashboard's own.
  // Newest rows by insertion order (the encrypted timestamp cannot be sorted in SQL either).
  return rows<any>('SELECT * FROM audit_logs ORDER BY rowid DESC LIMIT 2000')
    .filter((r) => String(r.action || '').startsWith('SS Connect'))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    .slice(0, limit)
    .map((r) => ({
      ts: String(r.timestamp || ''),
      actor: String(r.actorName || r.actor_name || ''),
      action: String(r.action || '').replace(/^SS Connect · ?/, ''),
      details: String(r.details || ''),
    }));
}
