/**
 * South Street Connect — messages, voice notes, calls and push for the
 * installable app (/connect). Messages live in the same `messages` table as the
 * portal chat, so a conversation is the same everywhere.
 *
 * Who talks to whom: clients ↔ the agency team (and their guide); the team ↔
 * everyone. Two clients talk only once one asked and the other accepted (see
 * links.ts / people.ts).
 *
 * Tables / columns are added on first use (not in the start-up setup).
 */
import crypto from 'crypto';
import { getSqliteDb } from '../sqlite';
import { decryptBytes, encryptBytes } from '../db-crypto';
import { buildDmChatId, parseDmChatId } from '../chat-utils';
import { normalizeLoginRole, LOGIN_ROLE_LABELS, type LoginRole } from '../roles';
import { isImageSource, resolveUserPhoto } from '../user-access-view';
import { publish } from './bus';
import { areFriends, friendIds } from './links';

export type ConnectUser = { id: string; name: string; role: LoginRole; roleLabel: string; photo: string };
/** `friend`: a client I accepted (or who accepted me); `affinity`: how much we talk lately (orders favourites). */
export type ConnectContact = ConnectUser & { chatId: string; online: boolean; lastText: string; lastTs: number; unread: number; friend: boolean; affinity: number };
export type ConnectMessage = {
  id: string;
  chatId: string;
  senderId: string;
  kind: 'text' | 'voice' | 'call';
  text: string;
  mediaId?: string;
  duration?: number;
  ts: number;
};
export type CallState = 'ringing' | 'active' | 'ended' | 'declined' | 'missed';
export type ConnectCall = {
  id: string;
  chatId: string;
  callerId: string;
  calleeId: string;
  state: CallState;
  offer?: string;
  answer?: string;
  createdTs: number;
  answeredTs?: number;
  endedTs?: number;
};

const ONLINE_MS = 45_000;
const RING_MS = 45_000;

function raw() {
  const db = getSqliteDb() as any;
  const prepare = (db.__rawPrepare as ((sql: string) => any) | undefined) || db.prepare.bind(db);
  return { prepare };
}

let ready = false;
function db() {
  const d = getSqliteDb();
  if (ready) return d;
  const cols = new Set((d.prepare('PRAGMA table_info(messages)').all() as { name: string }[]).map((c) => c.name));
  if (!cols.has('kind_type')) d.exec("ALTER TABLE messages ADD COLUMN kind_type TEXT DEFAULT 'text'");
  if (!cols.has('media_id')) d.exec('ALTER TABLE messages ADD COLUMN media_id TEXT');
  if (!cols.has('duration_sec')) d.exec('ALTER TABLE messages ADD COLUMN duration_sec INTEGER');
  if (!cols.has('ts')) d.exec('ALTER TABLE messages ADD COLUMN ts INTEGER');
  d.exec(`
    CREATE TABLE IF NOT EXISTS connect_reads (read_id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, user_id TEXT NOT NULL, read_ts INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS connect_presence (user_id TEXT PRIMARY KEY, seen_ts INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS connect_calls (
      call_id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, caller_id TEXT NOT NULL, callee_id TEXT NOT NULL,
      state_type TEXT NOT NULL, offer TEXT, answer TEXT, created_ts INTEGER NOT NULL, answered_ts INTEGER, ended_ts INTEGER
    );
    CREATE TABLE IF NOT EXISTS connect_ice (ice_id TEXT PRIMARY KEY, call_id TEXT NOT NULL, from_id TEXT NOT NULL, candidate TEXT NOT NULL, ts INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS connect_push (endpoint_key TEXT PRIMARY KEY, user_id TEXT NOT NULL, subscription TEXT NOT NULL, ts INTEGER NOT NULL);
  `);
  raw().prepare('CREATE TABLE IF NOT EXISTS connect_media (media_id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, mime_type TEXT NOT NULL, data BLOB NOT NULL, ts INTEGER NOT NULL)').run();
  ready = true;
  return d;
}

/* ---------------- people ---------------- */

function toUser(u: any): ConnectUser {
  const role = normalizeLoginRole(u.role);
  return {
    id: String(u.id),
    name: String(u.name || ''),
    role,
    roleLabel: LOGIN_ROLE_LABELS[role] || '',
    photo: isImageSource(u.avatar) ? resolveUserPhoto(u.avatar) || '' : '',
  };
}

export const isTeam = (role: LoginRole) => role !== 'PILGRIM_USER';

/** Clients and team members may talk; two clients only once they are linked (accepted). */
export function canTalk(a: ConnectUser, b: ConnectUser): boolean {
  if (a.id === b.id) return false;
  return isTeam(a.role) || isTeam(b.role) || areFriends(a.id, b.id);
}

export function activeUsers(): ConnectUser[] {
  return (db().prepare('SELECT id, name, role, avatar, loginEnabled, status FROM users').all() as any[])
    .filter((u) => u.loginEnabled !== 0 && !['SUSPENDED', 'REJECTED'].includes(String(u.status || '').toUpperCase()))
    .map(toUser);
}

export function userById(id: string): ConnectUser | null {
  return activeUsers().find((u) => u.id === id) || null;
}

export function touchPresence(userId: string) {
  db().prepare('INSERT INTO connect_presence (user_id, seen_ts) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET seen_ts = excluded.seen_ts').run(userId, Date.now());
}

function presenceMap(): Map<string, number> {
  return new Map((db().prepare('SELECT user_id, seen_ts FROM connect_presence').all() as any[]).map((r) => [String(r.user_id), Number(r.seen_ts) || 0]));
}

function readTs(chatId: string, userId: string): number {
  const r = db().prepare('SELECT read_ts FROM connect_reads WHERE read_id = ?').get(`${chatId}|${userId}`) as { read_ts?: number } | undefined;
  return Number(r?.read_ts) || 0;
}

export function markRead(chatId: string, userId: string) {
  db().prepare('INSERT INTO connect_reads (read_id, chat_id, user_id, read_ts) VALUES (?, ?, ?, ?) ON CONFLICT(read_id) DO UPDATE SET read_ts = excluded.read_ts')
    .run(`${chatId}|${userId}`, chatId, userId, Date.now());
}

const msgTs = (m: any) => Number(m.ts) || 0;

const HALF_LIFE_MS = 14 * 86_400_000;
/**
 * How close two people are lately: every message and call counts, recent ones
 * far more (half the weight after two weeks), calls three times a message.
 */
function affinityOf(list: any[], now: number): number {
  let score = 0;
  for (const m of list) {
    const age = Math.max(0, now - msgTs(m));
    score += (m.kind_type === 'call' ? 3 : 1) * Math.pow(0.5, age / HALF_LIFE_MS);
  }
  return Math.round(score * 100) / 100;
}

export function contactsFor(me: ConnectUser): ConnectContact[] {
  const d = db();
  const presence = presenceMap();
  const now = Date.now();
  const rows = d.prepare("SELECT chatId, senderId, text, kind_type, ts, rowid FROM messages WHERE chatId LIKE 'dm:%'").all() as any[];
  const byChat = new Map<string, any[]>();
  for (const r of rows) {
    if (!byChat.has(r.chatId)) byChat.set(r.chatId, []);
    byChat.get(r.chatId)!.push(r);
  }
  const friends = isTeam(me.role) ? new Set<string>() : friendIds(me.id);
  return activeUsers()
    .filter((u) => u.id !== me.id && (isTeam(me.role) || isTeam(u.role) || friends.has(u.id)))
    .map((u) => {
      const chatId = buildDmChatId(me.id, u.id);
      const list = (byChat.get(chatId) || []).sort((a, b) => msgTs(a) - msgTs(b) || a.rowid - b.rowid);
      const last = list[list.length - 1];
      const seen = readTs(chatId, me.id);
      return {
        ...u,
        chatId,
        online: now - (presence.get(u.id) || 0) < ONLINE_MS,
        lastText: last ? (last.kind_type === 'voice' ? '🎤 رسالة صوتية' : String(last.text || '')) : '',
        lastTs: last ? msgTs(last) : 0,
        unread: list.filter((m) => m.senderId !== me.id && msgTs(m) > seen).length,
        friend: friends.has(u.id),
        affinity: affinityOf(list, now),
      };
    })
    .sort((a, b) => b.lastTs - a.lastTs || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'ar'));
}

/* ---------------- messages ---------------- */

export function chatPeer(chatId: string, me: string): string | null {
  const pair = parseDmChatId(chatId);
  if (!pair || !pair.includes(me)) return null;
  return pair[0] === me ? pair[1] : pair[0];
}

export function messagesFor(chatId: string, since = 0, limit = 120): ConnectMessage[] {
  const rows = db()
    .prepare('SELECT id, chatId, senderId, text, kind_type, media_id, duration_sec, ts, rowid FROM messages WHERE chatId = ?')
    .all(chatId) as any[];
  return rows
    .sort((a, b) => msgTs(a) - msgTs(b) || a.rowid - b.rowid)
    .filter((m) => msgTs(m) > since)
    .slice(-limit)
    .map((m) => ({
      id: String(m.id),
      chatId: String(m.chatId),
      senderId: String(m.senderId),
      kind: m.kind_type === 'voice' ? 'voice' : m.kind_type === 'call' ? 'call' : 'text',
      text: String(m.text || ''),
      mediaId: m.media_id ? String(m.media_id) : undefined,
      duration: m.duration_sec ? Number(m.duration_sec) : undefined,
      ts: msgTs(m),
    }));
}

export function saveConnectMessage(from: ConnectUser, chatId: string, msg: { kind: ConnectMessage['kind']; text: string; mediaId?: string; duration?: number }): ConnectMessage {
  const id = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const ts = Date.now();
  db().prepare(
    `INSERT INTO messages (id, chatId, senderId, senderName, senderAvatar, senderRole, text, time, isUrgent, kind_type, media_id, duration_sec, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
  ).run(
    id, chatId, from.id, from.name, from.name.charAt(0) || 'م', from.role.toLowerCase(), msg.text.slice(0, 4000),
    new Date(ts).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
    msg.kind, msg.mediaId || null, msg.duration ?? null, ts
  );
  // Both sides' live connections learn about it at once.
  const pair = parseDmChatId(chatId);
  for (const uid of pair || []) publish(uid, { type: 'chat', chatId, ts });
  return { id, chatId, senderId: from.id, kind: msg.kind, text: msg.text, mediaId: msg.mediaId, duration: msg.duration, ts };
}

/** Newest message time in any of my conversations (cheap; for the live stream's fallback). */
export function latestActivity(userId: string): number {
  const d = db();
  let max = 0;
  for (const pattern of [`dm:${userId}:%`, `dm:%:${userId}`]) {
    const r = d.prepare('SELECT MAX(ts) AS t FROM messages WHERE chatId LIKE ?').get(pattern) as { t?: number } | undefined;
    max = Math.max(max, Number(r?.t) || 0);
  }
  return max;
}

export function saveVoice(chatId: string, data: Buffer, mime: string): string {
  db();
  const id = `${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
  // Voice is private: stored encrypted, like the other sensitive data.
  raw().prepare('INSERT INTO connect_media (media_id, chat_id, mime_type, data, ts) VALUES (?, ?, ?, ?, ?)').run(id, chatId, mime, encryptBytes(data), Date.now());
  return id;
}

export function loadVoice(id: string): { chatId: string; mime: string; data: Buffer } | null {
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return null;
  db();
  const r = raw().prepare('SELECT chat_id, mime_type, data FROM connect_media WHERE media_id = ?').get(id) as any;
  if (!r?.data) return null;
  return { chatId: String(r.chat_id), mime: String(r.mime_type), data: decryptBytes(Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data)) };
}

/** Last activity per chat for one user (the app polls this to know what changed). */
export function chatStamps(me: ConnectUser): { unread: number; stamps: Record<string, number> } {
  const contacts = contactsFor(me);
  return {
    unread: contacts.reduce((n, c) => n + c.unread, 0),
    stamps: Object.fromEntries(contacts.filter((c) => c.lastTs).map((c) => [c.chatId, c.lastTs])),
  };
}

/* ---------------- calls (WebRTC signalling) ---------------- */

function toCall(r: any): ConnectCall {
  return {
    id: String(r.call_id),
    chatId: String(r.chat_id),
    callerId: String(r.caller_id),
    calleeId: String(r.callee_id),
    state: r.state_type as CallState,
    offer: r.offer ? String(r.offer) : undefined,
    answer: r.answer ? String(r.answer) : undefined,
    createdTs: Number(r.created_ts) || 0,
    answeredTs: r.answered_ts ? Number(r.answered_ts) : undefined,
    endedTs: r.ended_ts ? Number(r.ended_ts) : undefined,
  };
}

export function getCall(id: string): ConnectCall | null {
  const r = db().prepare('SELECT * FROM connect_calls WHERE call_id = ?').get(id);
  return r ? expire(toCall(r)) : null;
}

/** A call nobody answered within RING_MS becomes "missed" (and is logged in the chat). */
function expire(call: ConnectCall): ConnectCall {
  if (call.state === 'ringing' && Date.now() - call.createdTs > RING_MS) {
    return finishCall(call, 'missed');
  }
  return call;
}

export function startCall(caller: ConnectUser, callee: ConnectUser, offer: string): ConnectCall {
  const d = db();
  // One call at a time per person: close any stale ringing call of the caller.
  for (const r of d.prepare("SELECT * FROM connect_calls WHERE state_type IN ('ringing','active') AND (caller_id = ? OR callee_id = ?)").all(caller.id, caller.id) as any[]) {
    finishCall(toCall(r), 'ended');
  }
  const id = `call_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const chatId = buildDmChatId(caller.id, callee.id);
  d.prepare('INSERT INTO connect_calls (call_id, chat_id, caller_id, callee_id, state_type, offer, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, chatId, caller.id, callee.id, 'ringing', offer.slice(0, 20000), Date.now());
  const call = getCall(id)!;
  publish(callee.id, { type: 'incoming', id, offer: call.offer, caller: { id: caller.id, name: caller.name, roleLabel: caller.roleLabel, photo: caller.photo } });
  return call;
}

export function busy(userId: string): boolean {
  const rows = db().prepare("SELECT * FROM connect_calls WHERE state_type IN ('ringing','active') AND (caller_id = ? OR callee_id = ?)").all(userId, userId) as any[];
  return rows.map(toCall).map(expire).some((c) => c.state === 'ringing' || c.state === 'active');
}

export function answerCall(call: ConnectCall, answer: string): ConnectCall {
  db().prepare("UPDATE connect_calls SET state_type = 'active', answer = ?, answered_ts = ? WHERE call_id = ? AND state_type = 'ringing'")
    .run(answer.slice(0, 20000), Date.now(), call.id);
  const updated = getCall(call.id)!;
  publish(call.callerId, { type: 'call', id: call.id, state: updated.state, answer: updated.answer || null });
  return updated;
}

export function finishCall(call: ConnectCall, state: 'ended' | 'declined' | 'missed'): ConnectCall {
  const d = db();
  const res = d.prepare("UPDATE connect_calls SET state_type = ?, ended_ts = ? WHERE call_id = ? AND state_type IN ('ringing','active')")
    .run(state, Date.now(), call.id);
  if (res.changes) {
    // Log the call in the conversation, like a phone's call history.
    const caller = userById(call.callerId);
    const seconds = call.answeredTs ? Math.round((Date.now() - call.answeredTs) / 1000) : 0;
    const text = state === 'missed' ? 'مكالمة فائتة' : state === 'declined' ? 'مكالمة مرفوضة' : seconds ? 'مكالمة صوتية' : 'مكالمة ملغاة';
    if (caller) saveConnectMessage(caller, call.chatId, { kind: 'call', text, duration: seconds || undefined });
  }
  const r = d.prepare('SELECT * FROM connect_calls WHERE call_id = ?').get(call.id);
  const done = toCall(r);
  if (res.changes) for (const uid of [call.callerId, call.calleeId]) publish(uid, { type: 'call', id: call.id, state: done.state });
  return done;
}

export function incomingFor(userId: string): ConnectCall | null {
  const rows = db().prepare("SELECT * FROM connect_calls WHERE callee_id = ? AND state_type = 'ringing'").all(userId) as any[];
  const live = rows.map(toCall).map(expire).filter((c) => c.state === 'ringing');
  return live.sort((a, b) => b.createdTs - a.createdTs)[0] || null;
}

export function addIce(call: ConnectCall, fromId: string, candidate: string) {
  const ts = Date.now();
  db().prepare('INSERT INTO connect_ice (ice_id, call_id, from_id, candidate, ts) VALUES (?, ?, ?, ?, ?)')
    .run(`${call.id}_${ts}_${crypto.randomBytes(3).toString('hex')}`, call.id, fromId, candidate.slice(0, 2000), ts);
  publish(fromId === call.callerId ? call.calleeId : call.callerId, { type: 'ice', id: call.id, candidate: candidate.slice(0, 2000), ts });
}

export function iceFor(callId: string, notFrom: string, since: number): { candidate: string; ts: number }[] {
  return (db().prepare('SELECT candidate, ts, from_id FROM connect_ice WHERE call_id = ?').all(callId) as any[])
    .filter((r) => r.from_id !== notFrom && Number(r.ts) > since)
    .map((r) => ({ candidate: String(r.candidate), ts: Number(r.ts) }))
    .sort((a, b) => a.ts - b.ts);
}

export function callHistory(userId: string, limit = 40): ConnectCall[] {
  return (db().prepare('SELECT * FROM connect_calls WHERE caller_id = ? OR callee_id = ?').all(userId, userId) as any[])
    .map(toCall)
    .sort((a, b) => b.createdTs - a.createdTs)
    .slice(0, limit);
}

/* ---------------- push subscriptions ---------------- */

/** A web-push subscription ({endpoint, keys}) or a native app token ({fcm, platform}). */
export function savePush(userId: string, subscription: unknown) {
  const json = JSON.stringify(subscription);
  const fcm = String((subscription as any)?.fcm || '');
  const endpoint = fcm ? '' : String((subscription as any)?.endpoint || '');
  if (fcm ? !/^[\w:.-]{20,400}$/.test(fcm) : !endpoint.startsWith('https://')) throw new Error('bad subscription');
  const key = crypto.createHash('sha256').update(fcm ? `fcm:${fcm}` : endpoint).digest('hex').slice(0, 40);
  db().prepare('INSERT INTO connect_push (endpoint_key, user_id, subscription, ts) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint_key) DO UPDATE SET user_id = excluded.user_id, subscription = excluded.subscription, ts = excluded.ts')
    .run(key, userId, json.slice(0, 4000), Date.now());
}

export function pushTargets(userId: string): { key: string; subscription: any }[] {
  return (db().prepare('SELECT endpoint_key, subscription FROM connect_push WHERE user_id = ?').all(userId) as any[])
    .map((r) => {
      try {
        return { key: String(r.endpoint_key), subscription: JSON.parse(String(r.subscription)) };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { key: string; subscription: any }[];
}

export function dropPush(key: string) {
  db().prepare('DELETE FROM connect_push WHERE endpoint_key = ?').run(key);
}

export function isOnline(userId: string): boolean {
  return Date.now() - (presenceMap().get(userId) || 0) < ONLINE_MS;
}
