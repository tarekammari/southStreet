import { NextRequest, NextResponse } from 'next/server';
import { ADMINS, requireRole } from '@/lib/staff-gate';
import { sendText, whatsappConfig } from '@/lib/whatsapp/cloud';
import { conversation, listConversations, markRead, messages, saveMessage, setBotEnabled, unreadTotal } from '@/lib/whatsapp/store';

export const dynamic = 'force-dynamic';

/** Team inbox for WhatsApp: list conversations, read one, reply by hand, hand back to Sakhr. */
const INBOX_ROLES = [...ADMINS, 'AGENCY_AGENT' as const];

export async function GET(req: NextRequest) {
  const gate = requireRole(req, INBOX_ROLES);
  if ('error' in gate) return gate.error;
  const configured = Boolean(whatsappConfig());
  const hash = req.nextUrl.searchParams.get('c');
  try {
    if (hash) {
      const conv = conversation(hash, true);
      if (!conv) return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
      markRead(hash);
      return NextResponse.json({ configured, conversation: { ...conv, unread: 0 }, messages: messages(hash, 120) });
    }
    return NextResponse.json({ configured, conversations: listConversations(150), unread: unreadTotal() });
  } catch {
    return NextResponse.json({ configured, conversations: [], unread: 0 });
  }
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, INBOX_ROLES);
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  const hash = String(body.c || '');
  const text = String(body.text || '').trim().slice(0, 3800);
  if (!text) return NextResponse.json({ error: 'اكتب رسالة' }, { status: 400 });
  const conv = hash ? conversation(hash, true) : null;
  if (!conv) return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  if (!whatsappConfig()) return NextResponse.json({ error: 'واتساب غير مربوط بعد' }, { status: 503 });
  try {
    const id = await sendText(conv.phone, text);
    saveMessage(conv.phone, { id: id || `agent_${Date.now()}`, direction: 'out', author: 'agent', body: text, agentName: gate.account.name || '' });
    // A person answered: Sakhr steps back until the customer writes "صخر" or the team hands it back.
    if (conv.botEnabled) setBotEnabled(hash, false);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const reEngage = String(err?.message || '').includes('24') || err?.status === 400;
    return NextResponse.json(
      { error: reEngage ? 'مرّت أكثر من 24 ساعة على آخر رسالة من العميل؛ واتساب لا يسمح بالرد الحر إلا بعد أن يراسلك العميل من جديد.' : 'تعذّر الإرسال عبر واتساب' },
      { status: 502 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const gate = requireRole(req, INBOX_ROLES);
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  const hash = String(body.c || '');
  if (!hash || !conversation(hash, true)) return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  setBotEnabled(hash, Boolean(body.botEnabled));
  return NextResponse.json({ success: true });
}
