import { NextResponse } from 'next/server';
import { requireSession } from '../staff-gate';
import { touchPresence, userById, type ConnectUser } from './store';
import { controlOf } from './policy';

/** The signed-in user of the Connect app (and a "seen now" mark), or a 401 response. */
export function connectSession(req: Request): { me: ConnectUser } | { error: NextResponse } {
  const gate = requireSession(req);
  if ('error' in gate) return { error: gate.error };
  const me = userById(gate.account.id);
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
