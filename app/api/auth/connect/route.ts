import { NextRequest, NextResponse } from 'next/server';
import { dbFindUserByCode, dbLogAudit } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code } = body;

    if (!code) {
      return NextResponse.json({ error: 'رمز الوصول الخاص مطلوب' }, { status: 400 });
    }

    const user = dbFindUserByCode(code);
    if (!user) {
      dbLogAudit(name || 'Unknown', 'unknown', 'فشل تسجيل دخول', `رمز وصول غير صحيح: ${code}`);
      return NextResponse.json({ error: 'رمز الوصول غير صحيح أو منتهي الصلاحية.' }, { status: 401 });
    }

    const token = signToken(user);
    dbLogAudit(user.name, user.role, 'تسجيل دخول ناجح', `رمز الوصول: ${user.code}`);

    return NextResponse.json({
      token,
      user
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'خطأ في خادم الأمان' }, { status: 500 });
  }
}
