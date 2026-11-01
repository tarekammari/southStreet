import { NextResponse } from 'next/server';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { dbLogAudit } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';
import { publish } from '@/lib/connect/bus';
import { pushTo } from '@/lib/connect/push';
import { auditLog, liveCalls, overview, people } from '@/lib/connect/admin';
import { controlOf, saveSettings, setControl, settings } from '@/lib/connect/policy';
import { finishCall, getCall, saveConnectMessage, userById, activeUsers, type ConnectUser } from '@/lib/connect/store';
import { buildDmChatId } from '@/lib/chat-utils';
import {
  addMembers, allGroups, createGroup, deleteGroup, getGroup, membersOf, postToGroup, programs,
  removeMember, setMemberRole, syncProgram, updateGroup,
} from '@/lib/connect/groups';

export const dynamic = 'force-dynamic';

/**
 * SS Connect control room (/connect/admin) — the Super Admin only (signed in
 * with the security key). Activity, never the content of private chats.
 *   GET  ?view=overview | people | calls | groups | group&id= | programs | audit | settings
 *   POST {action, ...}  — see the switch below; every action is written to the audit log.
 */
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  const url = new URL(req.url);
  switch (url.searchParams.get('view')) {
    case 'people':
      return json({ people: people() });
    case 'calls':
      return json({ calls: liveCalls() });
    case 'groups':
      return json({ groups: allGroups().map((g) => ({ ...g, members: membersOf(g.id).length })) });
    case 'group': {
      const g = getGroup(String(url.searchParams.get('id') || ''));
      if (!g) return json({ error: 'المجموعة غير موجودة' }, 404);
      return json({ group: g, members: membersOf(g.id) });
    }
    case 'programs':
      return json({ programs: programs() });
    case 'audit':
      return json({ log: auditLog() });
    case 'settings':
      return json({ settings: settings() });
    default:
      return json(overview());
  }
}

const days = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Date.now() + Math.min(n, 365) * 86_400_000 : null;
};

export async function POST(req: Request) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  const admin = userById(String(gate.account.id));
  if (!admin) return json({ error: 'الحساب غير متاح' }, 403);
  const body = await req.json().catch(() => ({}));
  const log = (action: string, details: string) => dbLogAudit(gate.account.name, gate.role, `SS Connect · ${action}`, details);
  const person = (id: unknown) => {
    const u = userById(String(id || ''));
    return u && u.role !== 'SUPER_ADMIN' ? u : null;
  };

  switch (body.action) {
    /* ---------- people ---------- */
    case 'suspend':
    case 'unsuspend':
    case 'block-calls':
    case 'allow-calls': {
      const u = person(body.userId);
      if (!u) return json({ error: 'غير متاح' }, 404);
      const on = body.action === 'suspend' || body.action === 'block-calls';
      const reason = String(body.reason || '').trim();
      const patch = body.action === 'suspend' || body.action === 'unsuspend' ? { suspended: on } : { callsBlocked: on };
      const c = setControl(u.id, on ? { ...patch, reason, untilTs: days(body.days) } : patch, gate.account.name);
      // A stopped person's call ends now, and their app learns it at once.
      if (on) endCallsOf(u.id);
      publish(u.id, { type: 'people', ts: Date.now() });
      const what = { suspend: 'إيقاف', unsuspend: 'رفع الإيقاف', 'block-calls': 'منع المكالمات', 'allow-calls': 'السماح بالمكالمات' }[body.action as string];
      log(what!, `${u.name}${reason ? ` — ${reason}` : ''}${on && c.untilTs ? ` (حتى ${new Date(c.untilTs).toLocaleDateString('ar-DZ')})` : ''}`);
      return json({ control: controlOf(u.id) });
    }
    case 'remove-devices': {
      const u = person(body.userId);
      if (!u) return json({ error: 'غير متاح' }, 404);
      const n = getSqliteDb().prepare('DELETE FROM connect_push WHERE user_id = ?').run(u.id).changes;
      log('إزالة الأجهزة', `${u.name} — ${n} جهاز`);
      return json({ removed: n });
    }

    /* ---------- calls ---------- */
    case 'end-call': {
      const call = getCall(String(body.id || ''));
      if (!call || (call.state !== 'ringing' && call.state !== 'active')) return json({ error: 'المكالمة انتهت' }, 404);
      finishCall(call, 'ended');
      log('إنهاء مكالمة', `${userById(call.callerId)?.name || '?'} ← ${userById(call.calleeId)?.name || '?'}`);
      return json({ success: true });
    }

    /* ---------- groups ---------- */
    case 'group-create': {
      const name = String(body.name || '').trim();
      if (!name) return json({ error: 'اكتب اسم المجموعة' }, 400);
      const g = createGroup({ name, description: body.description, packageId: body.packageId || null, mode: body.mode }, admin);
      log('إنشاء مجموعة', `${g.name}${g.packageName ? ` (برنامج: ${g.packageName})` : ''} — ${membersOf(g.id).length} عضو`);
      return json({ group: g });
    }
    case 'group-update': {
      const g = updateGroup(String(body.id || ''), { name: body.name, description: body.description, mode: body.mode, closed: typeof body.closed === 'boolean' ? body.closed : undefined });
      if (!g) return json({ error: 'المجموعة غير موجودة' }, 404);
      log('تعديل مجموعة', `${g.name} — ${g.closed ? 'مغلقة' : 'مفتوحة'} · ${g.mode === 'admins' ? 'المشرفون فقط يكتبون' : 'الجميع يكتب'}`);
      return json({ group: g });
    }
    case 'group-delete': {
      const g = getGroup(String(body.id || ''));
      if (!g) return json({ error: 'المجموعة غير موجودة' }, 404);
      deleteGroup(g.id);
      log('حذف مجموعة', g.name);
      return json({ success: true });
    }
    case 'group-add': {
      const g = getGroup(String(body.id || ''));
      if (!g) return json({ error: 'المجموعة غير موجودة' }, 404);
      const ids = (Array.isArray(body.userIds) ? body.userIds : []).map(String);
      const n = addMembers(g.id, ids, body.role === 'admin' ? 'admin' : 'member');
      log('إضافة أعضاء', `${g.name} — ${ids.map((id: string) => userById(id)?.name).filter(Boolean).join('، ')}`);
      return json({ added: n, members: membersOf(g.id) });
    }
    case 'group-remove': {
      const g = getGroup(String(body.id || ''));
      const u = userById(String(body.userId || ''));
      if (!g || !u) return json({ error: 'غير موجود' }, 404);
      removeMember(g.id, u.id);
      log('إخراج عضو', `${g.name} — ${u.name}`);
      return json({ members: membersOf(g.id) });
    }
    case 'group-role': {
      const g = getGroup(String(body.id || ''));
      const u = userById(String(body.userId || ''));
      if (!g || !u) return json({ error: 'غير موجود' }, 404);
      setMemberRole(g.id, u.id, body.role === 'admin' ? 'admin' : 'member');
      log(body.role === 'admin' ? 'تعيين مشرف' : 'إلغاء إشراف', `${g.name} — ${u.name}`);
      return json({ members: membersOf(g.id) });
    }
    case 'group-sync': {
      const g = getGroup(String(body.id || ''));
      if (!g?.packageId) return json({ error: 'المجموعة غير مرتبطة ببرنامج' }, 400);
      const n = syncProgram(g.id);
      log('مزامنة البرنامج', `${g.name} — انضم ${n}`);
      return json({ added: n, members: membersOf(g.id) });
    }

    /* ---------- announcements ---------- */
    case 'broadcast': {
      const text = String(body.text || '').trim().slice(0, 2000);
      if (!text) return json({ error: 'اكتب نص الإعلان' }, 400);
      if (body.target === 'group') {
        const g = getGroup(String(body.groupId || ''));
        if (!g || g.closed) return json({ error: 'المجموعة غير متاحة' }, 400);
        addMembers(g.id, [admin.id], 'admin');
        postToGroup(g, admin, { kind: 'text', text: `📢 ${text}` });
        log('إعلان لمجموعة', `${g.name}: ${text.slice(0, 80)}`);
        return json({ sent: membersOf(g.id).length - 1 });
      }
      const to = activeUsers().filter((u) => u.id !== admin.id && (body.target === 'clients' ? u.role === 'PILGRIM_USER' : body.target === 'team' ? u.role !== 'PILGRIM_USER' : true));
      for (const u of to) sendDirect(admin, u, `📢 ${text}`);
      log('إعلان عام', `${body.target === 'clients' ? 'العملاء' : body.target === 'team' ? 'الفريق' : 'الجميع'} (${to.length}): ${text.slice(0, 80)}`);
      return json({ sent: to.length });
    }

    /* ---------- rules for everyone ---------- */
    case 'settings': {
      const s = saveSettings({ calls: body.calls, clientChat: body.clientChat, relayOnly: body.relayOnly });
      if (!s.calls) for (const c of liveCalls()) {
        const call = getCall(c.id);
        const caller = call ? userById(call.callerId) : null;
        if (call && caller?.role !== 'SUPER_ADMIN') finishCall(call, 'ended');
      }
      log('الإعدادات العامة', `المكالمات: ${s.calls ? 'مفعّلة' : 'موقوفة'} · مراسلة العملاء بينهم: ${s.clientChat ? 'مفعّلة' : 'موقوفة'} · عبر خادم الوصل فقط: ${s.relayOnly ? 'نعم' : 'لا'}`);
      return json({ settings: s });
    }
  }
  return json({ error: 'إجراء غير معروف' }, 400);
}

function endCallsOf(userId: string) {
  for (const c of liveCalls()) {
    const call = getCall(c.id);
    if (call && (call.callerId === userId || call.calleeId === userId)) finishCall(call, 'ended');
  }
}

/** An announcement as a direct message from the Super Admin (+ notification). */
function sendDirect(from: ConnectUser, to: ConnectUser, text: string) {
  const chatId = buildDmChatId(from.id, to.id);
  const message = saveConnectMessage(from, chatId, { kind: 'text', text });
  void pushTo(to.id, { kind: 'message', title: from.name, body: text.slice(0, 140), tag: `chat-${chatId}`, url: `/connect?chat=${from.id}`, msgId: message.id, chatId });
}
