import { after, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { pushTargets, savePush } from '@/lib/connect/store';
import { pushTo, vapidPublicKey } from '@/lib/connect/push';

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
    if (!vapidPublicKey()) return NextResponse.json({ error: 'الإشعارات غير مفعّلة على الخادم', code: 'NO_PUSH' }, { status: 503 });
    const devices = pushTargets(s.me.id).length;
    if (!devices) return NextResponse.json({ error: 'هذا الجهاز غير مسجّل للإشعارات بعد', code: 'NO_DEVICE' }, { status: 409 });
    const id = `test-${Date.now()}`;
    after(async () => {
      await sleep(5000);
      for (let i = 0; i < 3; i++) {
        await pushTo(s.me.id, { kind: 'call', title: '📞 اختبار الرنين', body: 'هكذا تصلك المكالمة والتطبيق مغلق', tag: `call-${id}`, url: '/connect', callId: id });
        await sleep(6000);
      }
      await pushTo(s.me.id, { kind: 'call-end', title: 'انتهى اختبار الرنين', body: 'الرنين يعمل على هذا الجهاز ✓', tag: `call-${id}`, url: '/connect', callId: id });
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
