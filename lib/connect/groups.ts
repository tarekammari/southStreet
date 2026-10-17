/**
 * Group chats of SS Connect, run by the Super Admin (dashboard /connect/admin).
 *
 * A group is a conversation `grp:<id>` in the same `messages` table as the
 * one-to-one chats; its members are in connect_group_members. A group can be
 * tied to a programme (package): "sync" adds its pilgrims (bookings that are
 * not cancelled) and its guide. Group admins (and the Super Admin) manage it;
 * in "admins" mode only they can write (announcements). A closed group stays
 * readable but nobody can write. Tables are added on first use.
 */
import crypto from 'crypto';
import { getSqliteDb } from '../sqlite';
import { publish } from './bus';
import { pushTo } from './push';
import { activeUsers, messagesFor, readTs, saveConnectMessage, userById, type ConnectMessage, type ConnectUser } from './store';

export type GroupMode = 'all' | 'admins';
export type ConnectGroup = {
  id: string;
  chatId: string;
  name: string;
  description: string;
  packageId: string | null;
  packageName: string | null;
  mode: GroupMode;
  closed: boolean;
  createdBy: string;
  createdTs: number;
};
export type GroupMember = ConnectUser & { groupRole: 'admin' | 'member'; muted: boolean; addedTs: number };

const PREFIX = 'grp:';
export const groupChatId = (id: string) => `${PREFIX}${id}`;
export const groupIdOf = (chatId: string) => (chatId.startsWith(PREFIX) ? chatId.slice(PREFIX.length) : null);

let ready = false;
function db() {
  const d = getSqliteDb();
  if (ready) return d;
  d.exec(`
    CREATE TABLE IF NOT EXISTS connect_groups (
      group_id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, package_id TEXT,
      mode TEXT NOT NULL DEFAULT 'all', closed INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_ts INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connect_group_members (
      member_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', muted INTEGER NOT NULL DEFAULT 0, added_ts INTEGER NOT NULL
    );
  `);
  ready = true;
  return d;
}

function packageName(id: string | null): string | null {
  if (!id) return null;
  const r = getSqliteDb().prepare('SELECT name FROM packages WHERE package_id = ?').get(id) as { name?: string } | undefined;
  return r?.name ? String(r.name) : null;
}

function toGroup(r: any): ConnectGroup {
  return {
    id: String(r.group_id),
    chatId: groupChatId(String(r.group_id)),
    name: String(r.name || ''),
    description: String(r.description || ''),
    packageId: r.package_id ? String(r.package_id) : null,
    packageName: packageName(r.package_id ? String(r.package_id) : null),
    mode: r.mode === 'admins' ? 'admins' : 'all',
    closed: Boolean(r.closed),
    createdBy: String(r.created_by || ''),
    createdTs: Number(r.created_ts) || 0,
  };
}

export function getGroup(id: string): ConnectGroup | null {
  const r = db().prepare('SELECT * FROM connect_groups WHERE group_id = ?').get(id);
  return r ? toGroup(r) : null;
}

export function allGroups(): ConnectGroup[] {
  return (db().prepare('SELECT * FROM connect_groups').all() as any[]).map(toGroup).sort((a, b) => b.createdTs - a.createdTs);
}

export function membersOf(id: string): GroupMember[] {
  const rows = db().prepare('SELECT user_id, role, muted, added_ts FROM connect_group_members WHERE group_id = ?').all(id) as any[];
  const users = new Map(activeUsers().map((u) => [u.id, u]));
  return rows
    .map((r) => {
      const u = users.get(String(r.user_id));
      return u ? { ...u, groupRole: r.role === 'admin' ? ('admin' as const) : ('member' as const), muted: Boolean(r.muted), addedTs: Number(r.added_ts) || 0 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b!.groupRole === 'admin') - Number(a!.groupRole === 'admin') || a!.name.localeCompare(b!.name, 'ar')) as GroupMember[];
}

function memberRow(id: string, userId: string): { role: string; muted: number } | undefined {
  return db().prepare('SELECT role, muted FROM connect_group_members WHERE member_id = ?').get(`${id}|${userId}`) as any;
}

export const isMember = (id: string, userId: string) => Boolean(memberRow(id, userId));

/** May write here: a member of an open group; in "admins" mode only its admins. The Super Admin always. */
export function canPost(group: ConnectGroup, user: ConnectUser): boolean {
  if (user.role === 'SUPER_ADMIN') return !group.closed;
  const m = memberRow(group.id, user.id);
  if (!m || group.closed) return false;
  return group.mode === 'all' || m.role === 'admin';
}

/** Members' devices reload their lists (added / removed / renamed / closed). */
function touch(id: string, extra: string[] = []) {
  const ids = new Set([...membersOf(id).map((m) => m.id), ...extra]);
  for (const uid of ids) publish(uid, { type: 'people', ts: Date.now() });
}

export function createGroup(input: { name: string; description?: string; packageId?: string | null; mode?: GroupMode }, by: ConnectUser): ConnectGroup {
  const id = `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  db().prepare('INSERT INTO connect_groups (group_id, name, description, package_id, mode, closed, created_by, created_ts) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
    .run(id, input.name.trim().slice(0, 80), String(input.description || '').slice(0, 300), input.packageId || null, input.mode === 'admins' ? 'admins' : 'all', by.id, Date.now());
  addMembers(id, [by.id], 'admin');
  if (input.packageId) syncProgram(id);
  return getGroup(id)!;
}

export function updateGroup(id: string, patch: { name?: string; description?: string; mode?: GroupMode; closed?: boolean }): ConnectGroup | null {
  const g = getGroup(id);
  if (!g) return null;
  db().prepare('UPDATE connect_groups SET name = ?, description = ?, mode = ?, closed = ? WHERE group_id = ?').run(
    patch.name?.trim() ? patch.name.trim().slice(0, 80) : g.name,
    patch.description !== undefined ? String(patch.description).slice(0, 300) : g.description,
    patch.mode ? (patch.mode === 'admins' ? 'admins' : 'all') : g.mode,
    patch.closed !== undefined ? (patch.closed ? 1 : 0) : g.closed ? 1 : 0,
    id
  );
  touch(id);
  return getGroup(id);
}

/** Deletes the group, its members and its messages. */
export function deleteGroup(id: string) {
  const members = membersOf(id).map((m) => m.id);
  db().prepare('DELETE FROM connect_group_members WHERE group_id = ?').run(id);
  db().prepare('DELETE FROM connect_groups WHERE group_id = ?').run(id);
  getSqliteDb().prepare('DELETE FROM messages WHERE chatId = ?').run(groupChatId(id));
  for (const uid of members) publish(uid, { type: 'people', ts: Date.now() });
}

export function addMembers(id: string, userIds: string[], role: 'admin' | 'member' = 'member'): number {
  const known = new Set(activeUsers().map((u) => u.id));
  const ins = db().prepare('INSERT OR IGNORE INTO connect_group_members (member_id, group_id, user_id, role, muted, added_ts) VALUES (?, ?, ?, ?, 0, ?)');
  let added = 0;
  for (const uid of new Set(userIds)) {
    if (!known.has(uid)) continue;
    added += ins.run(`${id}|${uid}`, id, uid, role, Date.now()).changes;
  }
  if (added) touch(id);
  return added;
}

export function removeMember(id: string, userId: string) {
  db().prepare('DELETE FROM connect_group_members WHERE member_id = ?').run(`${id}|${userId}`);
  touch(id, [userId]);
}

export function setMemberRole(id: string, userId: string, role: 'admin' | 'member') {
  db().prepare('UPDATE connect_group_members SET role = ? WHERE member_id = ?').run(role, `${id}|${userId}`);
  touch(id);
}

/** A member mutes / unmutes the group's notifications for themself. */
export function setMuted(id: string, userId: string, muted: boolean) {
  db().prepare('UPDATE connect_group_members SET muted = ? WHERE member_id = ?').run(muted ? 1 : 0, `${id}|${userId}`);
}

/** The people of a programme: its pilgrims (bookings not cancelled) and its guide. */
export function programPeople(packageId: string): string[] {
  const d = getSqliteDb();
  const pilgrims = (d.prepare("SELECT customer_id, reservation_status FROM reservations WHERE package_id = ?").all(packageId) as any[])
    .filter((r) => r.customer_id && !['CANCELLED', 'REJECTED'].includes(String(r.reservation_status || '').toUpperCase()))
    .map((r) => String(r.customer_id));
  const pkg = d.prepare('SELECT morshid_id FROM packages WHERE package_id = ?').get(packageId) as { morshid_id?: string } | undefined;
  const guide = pkg?.morshid_id ? (d.prepare('SELECT id FROM users WHERE staffId = ?').get(pkg.morshid_id) as { id?: string } | undefined) : undefined;
  return [...pilgrims, ...(guide?.id ? [String(guide.id)] : [])];
}

/** Adds everyone of the group's programme who is not in it yet (the guide as a group admin). Returns how many joined. */
export function syncProgram(id: string): number {
  const g = getGroup(id);
  if (!g?.packageId) return 0;
  const people = programPeople(g.packageId);
  const d = getSqliteDb();
  const pkg = d.prepare('SELECT morshid_id FROM packages WHERE package_id = ?').get(g.packageId) as { morshid_id?: string } | undefined;
  const guide = pkg?.morshid_id ? (d.prepare('SELECT id FROM users WHERE staffId = ?').get(pkg.morshid_id) as { id?: string } | undefined) : undefined;
  let added = addMembers(id, people.filter((p) => p !== guide?.id), 'member');
  if (guide?.id) added += addMembers(id, [String(guide.id)], 'admin');
  return added;
}

/** Programmes (packages) for the "new group from a programme" picker, with how many people each has. */
export function programs(): { id: string; name: string; startDate: string | null; people: number }[] {
  const rows = getSqliteDb().prepare('SELECT package_id, name, start_date FROM packages').all() as any[];
  return rows
    .map((p) => ({ id: String(p.package_id), name: String(p.name || ''), startDate: p.start_date ? String(p.start_date) : null, people: programPeople(String(p.package_id)).length }))
    .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
}

/* ---------------- the conversation ---------------- */

export type MyGroup = ConnectGroup & { members: number; lastText: string; lastTs: number; unread: number; canPost: boolean; muted: boolean; admin: boolean };

/** My groups for the chat list: last message, unread, may I write. */
export function groupsFor(me: ConnectUser): MyGroup[] {
  const mine = db().prepare('SELECT group_id, role, muted FROM connect_group_members WHERE user_id = ?').all(me.id) as any[];
  return mine
    .map((m) => {
      const g = getGroup(String(m.group_id));
      if (!g) return null;
      const list = messagesFor(g.chatId, 0, 200);
      const last = list[list.length - 1];
      const seen = readTs(g.chatId, me.id);
      const count = db().prepare('SELECT COUNT(*) AS n FROM connect_group_members WHERE group_id = ?').get(g.id) as { n: number };
      return {
        ...g,
        members: Number(count.n) || 0,
        lastText: last ? `${last.senderId === me.id ? 'أنت' : userById(last.senderId)?.name || ''}: ${last.kind === 'voice' ? '🎤 رسالة صوتية' : last.text}` : g.description || '',
        lastTs: last?.ts || g.createdTs,
        unread: list.filter((x) => x.senderId !== me.id && x.ts > seen).length,
        canPost: canPost(g, me),
        muted: Boolean(m.muted),
        admin: m.role === 'admin' || me.role === 'SUPER_ADMIN',
      };
    })
    .filter(Boolean) as MyGroup[];
}

/** The messages, who wrote them (names), and when each other member last read (for "read by n"). */
export function groupConversation(g: ConnectGroup, me: ConnectUser, since = 0) {
  const members = membersOf(g.id);
  return {
    group: g,
    canPost: canPost(g, me),
    members: members.map((m) => ({ id: m.id, name: m.name, photo: m.photo, roleLabel: m.roleLabel, groupRole: m.groupRole })),
    reads: members.filter((m) => m.id !== me.id).map((m) => readTs(g.chatId, m.id)),
    messages: messagesFor(g.chatId, since),
  };
}

/** Posts to the group: every member's app updates at once; the others get a notification (unless muted). */
export function postToGroup(g: ConnectGroup, from: ConnectUser, msg: { kind: ConnectMessage['kind']; text: string; mediaId?: string; duration?: number }): ConnectMessage {
  const message = saveConnectMessage(from, g.chatId, msg);
  const preview = `${from.name}: ${msg.kind === 'voice' ? '🎤 رسالة صوتية' : msg.text.slice(0, 120)}`;
  const rows = db().prepare('SELECT user_id, muted FROM connect_group_members WHERE group_id = ?').all(g.id) as any[];
  for (const r of rows) {
    const uid = String(r.user_id);
    // The sender and members who muted the group: the list updates quietly.
    if (uid === from.id || r.muted) {
      publish(uid, { type: 'chat', chatId: g.chatId, ts: message.ts });
      continue;
    }
    // `from` is what the app opens: the group itself.
    publish(uid, { type: 'chat', chatId: g.chatId, ts: message.ts, msgId: message.id, from: g.chatId, name: g.name, preview });
    void pushTo(uid, { kind: 'message', title: g.name, body: preview, tag: `chat-${g.chatId}`, url: `/connect?chat=${g.chatId}`, msgId: message.id, chatId: g.chatId });
  }
  return message;
}
