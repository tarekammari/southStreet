import { NextResponse } from 'next/server';
import { requireSession } from '../staff-gate';
import { touchPresence, userById, type ConnectUser } from './store';
import { controlOf } from './policy';
import { deviceSession } from './device-session';

/**
 * The signed-in user of the Connect app (and a "seen now" mark), or a 401 response.
 * The site session comes first; once it has run out (24 h, 8 h for admins) the
 * device's own Connect session keeps the app signed in (lib/connect/device-session.ts).
 */
export function connectSession(req: Request): { me: ConnectUser } | { error: NextResponse } {
  const gate = requireSession(req);
  let userId = 'error' in gate ? '' : String(gate.account.id);
  if (!userId) {
    if ('error' in gate && gate.error.status !== 401) return { error: gate.error };
    userId = deviceSession(req)?.userId || '';
    if (!userId) return { error: 'error' in gate ? gate.error : NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 }) };
  }
  const me = userById(userId);
  if (!me) return { error: NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 }) };
  // Suspended from Connect by the Super Admin: every Connect request says so (the app shows why).
  const control = me.role === 'SUPER_ADMIN' ? null : controlOf(me.id);
  if (control?.suspended) {
    return {
      error: NextResponse.json(
        { error: 'تم إيقاف حسابك في SS Connect', code: 'CONNECT_SUSPENDED', reason: control.reason, untilTs: control.untilTs },
        { status: 403 }
      ),
    };
  }
  try {
    touchPresence(me.id);
  } catch {
    /* presence is best-effort */
  }
  return { me };
}
