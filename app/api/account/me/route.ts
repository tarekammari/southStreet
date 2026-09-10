import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/request-auth';
import { getSqliteDb } from '@/lib/sqlite';
import { isImageSource } from '@/lib/user-access-view';
import { LOGIN_ROLE_LABELS, normalizeLoginRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as any;
  if (!row) {
    return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
  }

  const role = normalizeLoginRole(row.role, { email: row.email, roleName: row.roleName });
  const avatar = String(row.avatar || '').trim();

  return NextResponse.json({
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.username,
      phone: row.phone,
      code: row.code || row.username,
      role,
      roleName: row.roleName || LOGIN_ROLE_LABELS[role] || row.role,
      status: row.status,
      avatar: isImageSource(avatar) ? avatar : (row.name ? String(row.name).charAt(0) : 'م'),
      photoUrl: isImageSource(avatar) ? '/api/account/avatar' : '',
    },
  });
}
