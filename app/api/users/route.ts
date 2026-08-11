import { NextRequest, NextResponse } from 'next/server';
import { dbGetUsers, dbCreateUser, dbLogAudit } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const users = dbGetUsers();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = verifyToken(token);

    const body = await req.json();
    const { name, role, roleName, phone, code } = body;

    if (!name || !role || !code) {
      return NextResponse.json({ error: 'الاسم والدور وكود الوصول مطلوبان' }, { status: 400 });
    }

    const newUser = dbCreateUser({
      name,
      role,
      roleName: roleName || role,
      phone: phone || '',
      code
    });

    dbLogAudit(payload?.name || 'Admin', payload?.role || 'admin', 'إصدار كود مستخدم جديد', `${name} - ${code}`);

    return NextResponse.json({ ok: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ error: 'فشل إنشاء كود الوصول' }, { status: 500 });
  }
}
