/**
 * South Street Connect — messages, voice notes, calls and push for the
 * installable app (/connect). Messages live in the same `messages` table as the
 * portal chat, so a conversation is the same everywhere.
 *
 * Who talks to whom: the team ↔ everyone; a client sees the Super Admin and
 * the guides (other staff only once they wrote to that client). Two clients talk only once one asked and the other accepted (see
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
import { listening, publish } from './bus';
import { areFriends, friendIds } from './links';
import { settings } from './policy';

export type ConnectUser = { id: string; name: string; role: LoginRole; roleLabel: string; photo: string };
/** `friend`: a client I accepted (or who accepted me); `affinity`: how much we talk lately (orders favourites). */
export type ConnectContact = ConnectUser & { chatId: string; online: boolean; lastSeen: number; lastText: string; lastTs: number; unread: number; friend: boolean; affinity: number };
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
  /** Device keys and signatures over the offer / answer (end-to-end check, lib/connect/e2e.ts). */
  offerKey?: string;
  offerSig?: string;
  answerKey?: string;
  answerSig?: string;
  createdTs: number;
  /** The callee's device confirmed it is ringing. */
  ringingTs?: number;
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
  const callCols = new Set((d.prepare('PRAGMA table_info(connect_calls)').all() as { name: string }[]).map((c) => c.name));
  for (const c of ['offer_key', 'offer_sig', 'answer_key', 'answer_sig']) if (!callCols.has(c)) d.exec(`ALTER TABLE connect_calls ADD COLUMN ${c} TEXT`);
  if (!callCols.has('ringing_ts')) d.exec('ALTER TABLE connect_calls ADD COLUMN ringing_ts INTEGER');
  const presCols = new Set((d.prepare('PRAGMA table_info(connect_presence)').all() as { name: string }[]).map((c) => c.name));
  if (!presCols.has('delivered_ts')) d.exec('ALTER TABLE connect_presence ADD COLUMN delivered_ts INTEGER');
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

/** The team members a client sees and may call first: the Super Admin and the guides. */
const CLIENT_SEES: LoginRole[] = ['SUPER_ADMIN', 'GUIDE_MURSHID'];

function hasConversation(chatId: string): boolean {
  return Boolean(db().prepare('SELECT 1 AS x FROM messages WHERE chatId = ? LIMIT 1').get(chatId));
}

/**
 * `me` may message / call `peer`: the team reaches everyone; a client reaches the
 * Super Admin and the guides, any staff member who already wrote to them (to
 * reply), and other clients only once linked (accepted).
 */
export function canTalk(me: ConnectUser, peer: ConnectUser): boolean {
  if (me.id === peer.id) return false;
  if (isTeam(me.role)) return true;
  if (isTeam(peer.role)) return CLIENT_SEES.includes(peer.role) || hasConversation(buildDmChatId(me.id, peer.id));
  // Clients writing to other clients can be switched off by the Super Admin.
  return settings().clientChat && areFriends(me.id, peer.id);
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

/** Last time one of the user's devices received everything sent to them (live connection or push). */
function deliveredTs(userId: string): number {
  const r = db().prepare('SELECT delivered_ts FROM connect_presence WHERE user_id = ?').get(userId) as { delivered_ts?: number } | undefined;
  return Number(r?.delivered_ts) || 0;
}

/**
 * A device of `userId` is connected / got a push: everything sent to them so far
 * is delivered. The senders of messages that were waiting see ✓✓ at once.
 */
export function markDelivered(userId: string, ts = Date.now()) {
  const before = deliveredTs(userId);
  if (ts <= before) return;
  db().prepare('INSERT INTO connect_presence (user_id, seen_ts, delivered_ts) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET delivered_ts = excluded.delivered_ts')
    .run(userId, Date.now(), ts);
  const waiting = db()
    .prepare('SELECT DISTINCT chatId, senderId FROM messages WHERE (chatId LIKE ? OR chatId LIKE ?) AND senderId != ? AND ts > ?')
    .all(`dm:${userId}:%`, `dm:%:${userId}`, userId, before) as { chatId: string; senderId: string }[];
  for (const w of waiting) publishReceipt(String(w.chatId), userId, String(w.senderId));
}

/** How far `peer` has received / read the conversation (for my ✓ / ✓✓ / blue ✓✓). */
export function receiptOf(chatId: string, peer: string): { delivered: number; read: number } {
  const read = readTs(chatId, peer);
  return { delivered: Math.max(deliveredTs(peer), read), read };
}

function publishReceipt(chatId: string, by: string, to: string) {
  publish(to, { type: 'receipt', chatId, by, ...receiptOf(chatId, by) });
}

export function lastSeen(userId: string): number {
  return presenceMap().get(userId) || 0;
}

function presenceMap(): Map<string, number> {
  return new Map((db().prepare('SELECT user_id, seen_ts FROM connect_presence').all() as any[]).map((r) => [String(r.user_id), Number(r.seen_ts) || 0]));
}

export function readTs(chatId: string, userId: string): number {
  const r = db().prepare('SELECT read_ts FROM connect_reads WHERE read_id = ?').get(`${chatId}|${userId}`) as { read_ts?: number } | undefined;
  return Number(r?.read_ts) || 0;
}

export function markRead(chatId: string, userId: string) {
  const before = readTs(chatId, userId);
  db().prepare('INSERT INTO connect_reads (read_id, chat_id, user_id, read_ts) VALUES (?, ?, ?, ?) ON CONFLICT(read_id) DO UPDATE SET read_ts = excluded.read_ts')
    .run(`${chatId}|${userId}`, chatId, userId, Date.now());
  // Messages from the other side were waiting: they now see the blue ✓✓.
  const peer = chatPeer(chatId, userId);
  if (!peer) return;
  const r = db().prepare('SELECT MAX(ts) AS t FROM messages WHERE chatId = ? AND senderId = ?').get(chatId, peer) as { t?: number } | undefined;
  if ((Number(r?.t) || 0) > before) publishReceipt(chatId, userId, peer);
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
    .filter((u) => u.id !== me.id && (isTeam(me.role) || friends.has(u.id) || (isTeam(u.role) && (CLIENT_SEES.includes(u.role) || byChat.has(buildDmChatId(me.id, u.id))))))
    .map((u) => {
      const chatId = buildDmChatId(me.id, u.id);
      const list = (byChat.get(chatId) || []).sort((a, b) => msgTs(a) - msgTs(b) || a.rowid - b.rowid);
      const last = list[list.length - 1];
      const seen = readTs(chatId, me.id);
      return {
        ...u,
        chatId,
        online: now - (presence.get(u.id) || 0) < ONLINE_MS,
        lastSeen: presence.get(u.id) || 0,
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
  // Both sides' live connections learn about it at once (with what the banner shows).
  const pair = parseDmChatId(chatId);
  // Call-log lines are not announced: the call screen already showed the call.
  const preview = msg.kind === 'voice' ? '🎤 رسالة صوتية' : msg.text.slice(0, 140);
  for (const uid of pair || []) {
    publish(uid, uid === from.id || msg.kind === 'call' ? { type: 'chat', chatId, ts } : { type: 'chat', chatId, ts, msgId: id, from: from.id, name: from.name, preview });
  }
  // The other side has a device connected right now: delivered.
  const peer = pair?.find((uid) => uid !== from.id);
  if (peer && listening(peer)) markDelivered(peer, ts);
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
    offerKey: r.offer_key ? String(r.offer_key) : undefined,
    offerSig: r.offer_sig ? String(r.offer_sig) : undefined,
    answerKey: r.answer_key ? String(r.answer_key) : undefined,
    answerSig: r.answer_sig ? String(r.answer_sig) : undefined,
    createdTs: Number(r.created_ts) || 0,
    ringingTs: r.ringing_ts ? Number(r.ringing_ts) : undefined,
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

/** Device key (public, base64) and signature as sent by the app; anything else is dropped. */
export type Signed = { key?: string; sig?: string };
const cleanKey = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9+/=_-]{40,400}$/.test(v) ? v : null);

export function startCall(caller: ConnectUser, callee: ConnectUser, offer: string, signed: Signed = {}): ConnectCall {
  const d = db();
  // Old calls: their network candidates and setup (which hold IP addresses) are not kept.
  const dayAgo = Date.now() - 86_400_000;
  d.prepare('DELETE FROM connect_ice WHERE ts < ?').run(dayAgo);
  d.prepare('UPDATE connect_calls SET offer = NULL, answer = NULL WHERE created_ts < ? AND (offer IS NOT NULL OR answer IS NOT NULL)').run(dayAgo);
  // One call at a time per person: close any stale ringing call of the caller.
  for (const r of d.prepare("SELECT * FROM connect_calls WHERE state_type IN ('ringing','active') AND (caller_id = ? OR callee_id = ?)").all(caller.id, caller.id) as any[]) {
    finishCall(toCall(r), 'ended');
  }
  const id = `call_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const chatId = buildDmChatId(caller.id, callee.id);
  d.prepare('INSERT INTO connect_calls (call_id, chat_id, caller_id, callee_id, state_type, offer, offer_key, offer_sig, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, chatId, caller.id, callee.id, 'ringing', offer.slice(0, 20000), cleanKey(signed.key), cleanKey(signed.sig), Date.now());
  const call = getCall(id)!;
  publish(callee.id, incomingEvent(call, caller));
  return call;
}

/** What the callee's devices get: the offer, who calls, and the caller's signature. */
export function incomingEvent(call: ConnectCall, caller: ConnectUser) {
  return {
    type: 'incoming' as const,
    id: call.id,
    offer: call.offer,
    key: call.offerKey,
    sig: call.offerSig,
    caller: { id: caller.id, name: caller.name, roleLabel: caller.roleLabel, photo: caller.photo },
  };
}

/** The callee's device confirms it is ringing: the caller sees «يرنّ…» instead of «جارٍ الاتصال…». */
export function ringingCall(call: ConnectCall): ConnectCall {
  if (call.state !== 'ringing' || call.ringingTs) return call;
  const ts = Date.now();
  db().prepare('UPDATE connect_calls SET ringing_ts = ? WHERE call_id = ? AND ringing_ts IS NULL').run(ts, call.id);
  publish(call.callerId, { type: 'call', id: call.id, state: 'ringing', ringingTs: ts });
  return { ...call, ringingTs: ts };
}

export function busy(userId: string): boolean {
  const rows = db().prepare("SELECT * FROM connect_calls WHERE state_type IN ('ringing','active') AND (caller_id = ? OR callee_id = ?)").all(userId, userId) as any[];
  return rows.map(toCall).map(expire).some((c) => c.state === 'ringing' || c.state === 'active');
}

export function answerCall(call: ConnectCall, answer: string, signed: Signed = {}): ConnectCall {
  db().prepare("UPDATE connect_calls SET state_type = 'active', answer = ?, answer_key = ?, answer_sig = ?, answered_ts = ? WHERE call_id = ? AND state_type = 'ringing'")
    .run(answer.slice(0, 20000), cleanKey(signed.key), cleanKey(signed.sig), Date.now(), call.id);
  const updated = getCall(call.id)!;
  publish(call.callerId, { type: 'call', id: call.id, state: updated.state, answer: updated.answer || null, key: updated.answerKey || null, sig: updated.answerSig || null });
  // The callee's other devices (phone + computer) stop ringing: answered elsewhere.
  publish(call.calleeId, { type: 'call', id: call.id, state: updated.state });
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

/** A message for the other side of the call, in order: a network candidate (≤ 2 KB) or a reconnect offer / answer (≤ 16 KB). */
export function addIce(call: ConnectCall, fromId: string, candidate: string, max = 2000) {
  if (candidate.length > max) return;
  const ts = Date.now();
  db().prepare('INSERT INTO connect_ice (ice_id, call_id, from_id, candidate, ts) VALUES (?, ?, ?, ?, ?)')
    .run(`${call.id}_${ts}_${crypto.randomBytes(3).toString('hex')}`, call.id, fromId, candidate, ts);
  publish(fromId === call.callerId ? call.calleeId : call.callerId, { type: 'ice', id: call.id, candidate, ts });
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
/** Row key of a subscription (web push endpoint or native app token); throws when it is not one. */
function pushKeyOf(subscription: unknown): string {
  const fcm = String((subscription as any)?.fcm || '');
  const endpoint = fcm ? '' : String((subscription as any)?.endpoint || '');
  if (fcm ? !/^[\w:.-]{20,400}$/.test(fcm) : !endpoint.startsWith('https://')) throw new Error('bad subscription');
  return crypto.createHash('sha256').update(fcm ? `fcm:${fcm}` : endpoint).digest('hex').slice(0, 40);
}

export function savePush(userId: string, subscription: unknown) {
  const json = JSON.stringify(subscription);
  const key = pushKeyOf(subscription);
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

/** This device signed out: it stops getting this account's messages and calls. */
export function removePush(userId: string, subscription: unknown) {
  db().prepare('DELETE FROM connect_push WHERE endpoint_key = ? AND user_id = ?').run(pushKeyOf(subscription), userId);
}

export function dropPush(key: string) {
  db().prepare('DELETE FROM connect_push WHERE endpoint_key = ?').run(key);
}

export function isOnline(userId: string): boolean {
  return Date.now() - (presenceMap().get(userId) || 0) < ONLINE_MS;
}
