import { NextRequest, NextResponse } from 'next/server';
import { dbGetUsers, dbCreateUser, dbLogAudit } from '@/lib/db';
import { normalizeLoginRole } from '@/lib/roles';
import { ADMINS, requireRole } from '@/lib/staff-gate';
import { assignableRoles } from '@/lib/permissions';

/**
 * Legacy access-code users. Admin-only; Admin accounts are created through
 * /api/admin/users (activation link + security key), never here.
 */

export async function GET(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  return NextResponse.json(dbGetUsers());
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json().catch(() => ({}));
    const { name, role, roleName, phone, code } = body;

    if (!name || !role || !code) {
      return NextResponse.json({ error: 'الاسم والدور وكود الوصول مطلوبان' }, { status: 400 });
    }
    const loginRole = normalizeLoginRole(String(role));
    if (loginRole === 'AGENCY_MANAGER' || !assignableRoles(gate.role).includes(loginRole)) {
      return NextResponse.json({ error: 'لا تملك صلاحية إنشاء حساب بهذا الدور' }, { status: 403 });
    }

    const newUser = dbCreateUser({
      name: String(name).slice(0, 120),
      role,
      roleName: roleName || role,
      phone: phone || '',
      code: String(code).slice(0, 40),
    });

    dbLogAudit(gate.account.name || 'Admin', gate.role, 'إصدار كود مستخدم جديد', `${name} - ${code}`);
    return NextResponse.json({ ok: true, user: newUser });
  } catch {
    return NextResponse.json({ error: 'فشل إنشاء كود الوصول' }, { status: 500 });
  }
}
