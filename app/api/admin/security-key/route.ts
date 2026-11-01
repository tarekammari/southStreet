import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { getAdminKeyMeta } from '@/lib/admin-key';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN']);

function requireAdmin(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  return 'error' in gate ? null : gate.payload;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'مطلوب تسجيل دخول الإدارة' }, { status: 401 });
  }
  return NextResponse.json(getAdminKeyMeta());
}

/**
 * The legacy key file (southstreet_admin.key) is retired: sign-in uses
 * hardware security keys, and recovery is `npm run admin:recover` on the
 * server. New key files are no longer issued.
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'مطلوب تسجيل دخول الإدارة' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'ملف المفتاح القديم لم يعد يُصدر — الدخول بمفاتيح الأمان فقط' },
    { status: 410 }
  );
}
