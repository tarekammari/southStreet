import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { isPrivilegedRole } from '@/lib/roles';
import { checkPrivilegedPassword } from '@/lib/password-policy';
import {
  changeOwnPassword,
  getAccountByUserId,
  rotateOwnQr,
} from '@/lib/accounts';

export const dynamic = 'force-dynamic';

function qrImageSrc(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&margin=8&data=${encodeURIComponent(payload)}`;
}

/** Shared gate: key-verified sessions for Super Admin / Admin, revocation honoured. */
function requireUser(req: NextRequest) {
  const gate = requireSession(req);
  if ('error' in gate) return null;
  return { id: gate.account.id as string, role: gate.role, username: gate.account.username as string };
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
      const nextPassword = String(body.nextPassword || '');
      if (isPrivilegedRole(auth.role)) {
        const policy = checkPrivilegedPassword(nextPassword, auth.username);
        if (!policy.ok) {
          return NextResponse.json({ error: `كلمة المرور ضعيفة: ${policy.errors.join('، ')}` }, { status: 400 });
        }
      }
      changeOwnPassword(auth.id, currentPassword, nextPassword);
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
