import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { getAdminKeyMeta, rotateAdminSecurityKey } from '@/lib/admin-key';
import { resolveRequestIp } from '@/lib/security-threats';

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
    return NextResponse.json({ error: 'مطلوب تسجيل دخول الإدارة' }, { status: 401 });
  }
  return NextResponse.json(getAdminKeyMeta());
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'مطلوب تسجيل دخول الإدارة' }, { status: 401 });
  }

  try {
    const ip = resolveRequestIp({
      forwarded: req.headers.get('x-forwarded-for'),
      realIp: req.headers.get('x-real-ip'),
      fallback: '127.0.0.1',
    });
    const rotated = rotateAdminSecurityKey(admin.name || 'الإدارة', ip);
    return NextResponse.json({
      success: true,
      message: 'تم توليد مفتاح أمان جديد بنجاح. المفتاح السابق لم يعد صالحاً.',
      fileName: rotated.fileName,
      fileContent: rotated.fileContent,
      fingerprint: rotated.fingerprint,
      issuedAt: rotated.issuedAt,
    });
  } catch {
    return NextResponse.json({ error: 'خطأ في توليد مفتاح الأمان' }, { status: 500 });
  }
}
