import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/request-auth';
import {
  changeOwnPassword,
  getAccountByUserId,
  rotateOwnQr,
} from '@/lib/accounts';

export const dynamic = 'force-dynamic';

function qrImageSrc(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&margin=8&data=${encodeURIComponent(payload)}`;
}

function requireUser(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth?.id) return null;
  return auth;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإدارة أمان الحساب' }, { status: 401 });
    }
    const account = getAccountByUserId(auth.id);
    if (!account) {
      return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ account });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب بيانات الأمان' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإدارة أمان الحساب' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || '';
    const currentPassword = String(body.currentPassword || '');

    if (action === 'change-password') {
      changeOwnPassword(auth.id, currentPassword, String(body.nextPassword || ''));
      return NextResponse.json({
        success: true,
        message: 'تم تغيير كلمة المرور. استخدمها في الدخول التالي.',
        account: getAccountByUserId(auth.id),
      });
    }

    if (action === 'rotate-qr') {
      const qr = rotateOwnQr(auth.id, currentPassword);
      return NextResponse.json({
        success: true,
        message: 'تم استبدال رمز QR. الرمز السابق لم يعد يعمل.',
        account: getAccountByUserId(auth.id),
        qrPayload: qr.qrPayload,
        qrImage: qrImageSrc(qr.qrPayload),
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر تحديث أمان الحساب' }, { status: 400 });
  }
}
