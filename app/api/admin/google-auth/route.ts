import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { getGoogleClientId, isGoogleClientId, saveGoogleClientId } from '@/lib/google-auth-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) return null;
  const role = normalizeLoginRole(String(payload.role || ''), {
    email: payload.email,
    roleName: payload.roleName,
  });
  if (!ADMIN_ROLES.has(role)) return null;
  return payload;
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
