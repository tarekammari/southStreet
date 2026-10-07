import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { getGoogleClientId, isGoogleClientId, saveGoogleClientId } from '@/lib/google-auth-config';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

/** Sign-in configuration is a security setting: Super Admin only. */
function requireAdmin(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  return 'error' in gate ? null : gate.payload;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });
  }
  const clientId = getGoogleClientId();
  return NextResponse.json({
    googleClientId: clientId,
    enabled: Boolean(clientId),
  });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.google_client_id || body?.googleClientId || '').trim();

  if (clientId && !isGoogleClientId(clientId)) {
    return NextResponse.json(
      { error: 'المعرف يجب أن يكون Web Client ID وينتهي بـ .apps.googleusercontent.com' },
      { status: 400 }
    );
  }

  const saved = saveGoogleClientId(clientId);
  return NextResponse.json({
    ok: true,
    googleClientId: saved,
    enabled: Boolean(saved),
    message: saved
      ? 'تم حفظ مفتاح دخول جوجل. يمكن للأعضاء الدخول بحساب جوجل الآن.'
      : 'تم إيقاف دخول جوجل.',
  });
}
