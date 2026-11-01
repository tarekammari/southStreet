import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { deviceSession, endDeviceSession, shouldRotate, startDeviceSession } from '@/lib/connect/device-session';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';

export const dynamic = 'force-dynamic';

/**
 * POST — keep SS Connect signed in on this device (lib/connect/device-session.ts):
 *        renews the device's Connect session, or starts one from the site session.
 * DELETE — sign out of Connect on this device (and of the site in this browser).
 */
export async function POST(req: Request) {
  const current = deviceSession(req);
  const gate = requireSession(req);
  const res = NextResponse.json({ ok: true });

  // Signed in on the site (maybe as another account): the Connect session follows it.
  if (!('error' in gate) && current?.userId !== String(gate.account.id)) {
    startDeviceSession(res, req, { id: String(gate.account.id), tokenVersion: gate.account.tokenVersion, mfa: gate.payload.mfa === true }, current?.sid);
    return res;
  }
  if (!current) return 'error' in gate ? gate.error : res;
  // Once a day a fresh session (new id, new 90 days): an app in use never runs out.
  if (shouldRotate(current.createdTs)) {
    startDeviceSession(res, req, { id: current.userId, tokenVersion: current.tv, mfa: current.mfa }, current.sid);
  }
  return res;
}

export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true });
  endDeviceSession(res, req);
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0, req));
  return res;
}
