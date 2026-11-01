import { pushTo } from '@/lib/connect/push';
import { deviceLabel } from '@/lib/user-access-view';
import type { ClientMeta } from '@/lib/login-session';

/**
 * "New sign-in to your account" on the Super Admin's phone (Connect push: the
 * Android app and installed web apps, even when closed). Sent for every new
 * Super Admin session, whatever the method, so nothing opens unnoticed.
 */

const METHOD_LABELS: Record<string, string> = {
  password: 'كلمة المرور',
  'security-key': 'البصمة / مفتاح الأمان',
  'recovery-code': 'رمز استرداد',
  'google-owner': 'Google',
  'qr-phone-link': 'رمز QR من الهاتف',
};

export async function alertSuperAdminSignIn(user: { id: string }, meta: ClientMeta, method: string): Promise<void> {
  const how = METHOD_LABELS[method] || method;
  await pushTo(String(user.id), {
    kind: 'message',
    title: '🔐 دخول جديد إلى حساب المشرف العام',
    body: `${deviceLabel(meta.userAgent)} · ${meta.clientIp} · ${how}. إن لم يكن أنت فسجّل الخروج من كل الأجهزة.`,
    tag: `signin-${Date.now()}`,
    url: '/admin?devices=1',
  });
}
