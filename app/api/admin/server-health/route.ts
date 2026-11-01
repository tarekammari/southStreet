import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { getServerHealth } from '@/lib/server-health';
import { isServerlessHost } from '@/lib/db-path';
import { resolveRequestIp } from '@/lib/security-threats';
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

  try {
    return NextResponse.json(getServerHealth());
  } catch {
    return NextResponse.json({ error: 'تعذّر قراءة حالة الخادم' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'مطلوب تسجيل دخول الإدارة' }, { status: 401 });
  }

  let body: { action?: string; confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action || '');
  const ip = resolveRequestIp({
    forwarded: req.headers.get('x-forwarded-for'),
    realIp: req.headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });

  if (action === 'stop') {
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'يلزم تأكيد إيقاف الخادم' }, { status: 400 });
    }
    if (isServerlessHost()) {
      return NextResponse.json({ error: 'لا يمكن إيقاف الخادم على استضافة بدون عملية دائمة' }, { status: 400 });
    }
    setTimeout(() => {
      process.exit(0);
    }, 600);
    return NextResponse.json({
      success: true,
      stopping: true,
      message: 'جاري إيقاف الخادم…',
    });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
