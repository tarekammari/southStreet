import { NextRequest, NextResponse } from 'next/server';
import { ADMINS, requireRole } from '@/lib/staff-gate';
import { guideIdForUser, guideProfile, guidePrograms, setCheckin } from '@/lib/guide';
import { isGuideStage } from '@/lib/guide-stages';
import { dbSaveMessage } from '@/lib/db';
import { buildDmChatId } from '@/lib/chat-utils';

export const dynamic = 'force-dynamic';

/**
 * Guide workspace (portal → لوحة المرشد).
 *   GET                     the guide's programs, groups and check-ins
 *   POST {action:'checkin'} tick / untick a stage for one booking
 *   POST {action:'message'} send a message to every client of one program
 * A guide sees and acts on his own programs only. Admins may pass ?guide=<id>.
 */
const ROLES = [...ADMINS, 'GUIDE_MURSHID' as const];
const sent = new Map<string, number[]>();

function resolveGuide(req: NextRequest, gate: { role: string; account: { id: string } }): string | null {
  const asked = req.nextUrl.searchParams.get('guide');
  if (asked && ADMINS.includes(gate.role as (typeof ADMINS)[number])) return asked;
  return guideIdForUser(gate.account.id);
}

export async function GET(req: NextRequest) {
  const gate = requireRole(req, ROLES);
  if ('error' in gate) return gate.error;
  const guideId = resolveGuide(req, gate);
  if (!guideId) {
    return NextResponse.json({ guide: null, programs: [], notice: 'حسابك غير مرتبط بملف مرشد بعد. اطلب من الإدارة إكمال ملفك في «الفريق والحسابات».' });
  }
  return NextResponse.json({ guide: guideProfile(guideId), programs: guidePrograms(guideId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, ROLES);
  if ('error' in gate) return gate.error;
  const guideId = resolveGuide(req, gate);
  if (!guideId) return NextResponse.json({ error: 'حسابك غير مرتبط بملف مرشد' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'checkin') {
    if (!isGuideStage(body.stage)) return NextResponse.json({ error: 'مرحلة غير معروفة' }, { status: 400 });
    try {
      setCheckin(guideId, {
        packageId: String(body.packageId || ''),
        reservationId: String(body.reservationId || ''),
        stage: body.stage,
        done: Boolean(body.done),
        byName: gate.account.name || '',
      });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: 'هذا الحجز ليس ضمن برامجك' }, { status: 403 });
    }
  }

  if (body.action === 'message') {
    const text = String(body.text || '').trim().slice(0, 1000);
    if (!text) return NextResponse.json({ error: 'اكتب الرسالة' }, { status: 400 });
    const program = guidePrograms(guideId).find((p) => p.packageId === String(body.packageId || ''));
    if (!program) return NextResponse.json({ error: 'البرنامج ليس ضمن برامجك' }, { status: 403 });

    // At most 10 group messages per 10 minutes per guide.
    const now = Date.now();
    const recent = (sent.get(guideId) || []).filter((t) => now - t < 600_000);
    if (recent.length >= 10) return NextResponse.json({ error: 'رسائل كثيرة — انتظر قليلاً' }, { status: 429 });
    sent.set(guideId, [...recent, now]);

    const recipients = Array.from(new Set(program.bookings.map((b) => b.customerId).filter(Boolean)));
    const sender = gate.account;
    for (const customerId of recipients) {
      dbSaveMessage({
        id: '',
        chatId: buildDmChatId(customerId, sender.id),
        senderId: sender.id,
        senderName: sender.name || 'المرشد',
        senderAvatar: (sender.name || 'م').charAt(0),
        senderRole: 'murshid',
        text: `📢 ${program.name}\n${text}`,
        time: '',
      } as any);
    }
    return NextResponse.json({ success: true, sent: recipients.length });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
