import { NextResponse } from 'next/server';

/**
 * Retired: this endpoint issued a session for anyone who knew a user's access
 * code — no password, no security key, no rate limit — which bypassed the
 * SUPER_ADMIN key step. Sign-in goes through /api/admin/auth (or Google).
 */
export async function POST() {
  return NextResponse.json(
    { error: 'طريقة الدخول هذه متوقفة. استخدم نافذة تسجيل الدخول.' },
    { status: 410 }
  );
}
