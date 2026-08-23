import { NextResponse } from 'next/server';
import { registerSelfAccount } from '@/lib/accounts';
import { generateDeviceFingerprint } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.website_hp && String(body.website_hp).trim()) {
      return NextResponse.json({ error: 'تم حظر الطلب' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || '';
    const { pcPrint } = generateDeviceFingerprint(ip, userAgent, req.headers.get('accept-language') || '');

    const created = registerSelfAccount({
      name: String(body.name || ''),
      username: String(body.username || ''),
      password: String(body.password || ''),
      email: body.email,
      phone: body.phone,
      ip,
      pcPrint,
      userAgent,
    });

    return NextResponse.json({
      status: 'PENDING_APPROVAL',
      username: created.username,
      message: 'تم إنشاء الحساب. سجّل الدخول بعد موافقة الإدارة وتحديد صلاحيتك.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إنشاء الحساب' }, { status: 400 });
  }
}
