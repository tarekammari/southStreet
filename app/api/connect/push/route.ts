import { after, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { pushTargets, removePush, savePush } from '@/lib/connect/store';
import { pushReady, pushTo } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST {subscription}   — this device wants notifications for messages and calls.
 * POST {action:'test'}  — ring this account in 5 seconds (close the app to see the
 *                         closed-app ringing), then stop after 20 seconds.
 */
export async function POST(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));

  if (body.action === 'test') {
    if (!pushReady()) return NextResponse.json({ error: 'الإشعارات غير مفعّلة على الخادم', code: 'NO_PUSH' }, { status: 503 });
    const devices = pushTargets(s.me.id).length;
    if (!devices) return NextResponse.json({ error: 'هذا الجهاز غير مسجّل للإشعارات بعد', code: 'NO_DEVICE' }, { status: 409 });
    const id = `test-${Date.now()}`;
    after(async () => {
      await sleep(5000);
      const common = { tag: `call-${id}`, url: '/connect', callId: id, caller: 'اختبار الرنين', role: 'South Street Connect' };
      await pushTo(s.me.id, { ...common, kind: 'call', title: '📞 اختبار الرنين', body: 'هكذا تصلك المكالمة والتطبيق مغلق' });
      await sleep(20000);
      await pushTo(s.me.id, { ...common, kind: 'call-end', outcome: 'ended', title: 'انتهى اختبار الرنين', body: 'الرنين يعمل على هذا الجهاز ✓' });
    });
    return NextResponse.json({ success: true, devices });
  }

  try {
    savePush(s.me.id, body.subscription);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'اشتراك غير صالح' }, { status: 400 });
  }
}

/** DELETE {subscription} — this device signed out: no more notifications for this account here. */
export async function DELETE(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));
  try {
    removePush(s.me.id, body.subscription);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'اشتراك غير صالح' }, { status: 400 });
  }
}
