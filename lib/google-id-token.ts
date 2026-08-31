import { getGoogleClientId } from './google-auth-config';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('تسجيل جوجل غير مُعد. من لوحة الإدارة ← دخول جوجل الصق معرف عميل جوجل.');
  if (!idToken) throw new Error('رمز جوجل مفقود');

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error('تعذر التحقق من حساب جوجل');
  if (data.aud !== clientId) throw new Error('معرف تطبيق جوجل غير مطابق');
  if (data.email_verified !== 'true' && data.email_verified !== true) {
    throw new Error('بريد جوجل غير موثّق');
  }

  return {
    googleId: String(data.sub),
    email: String(data.email || '').toLowerCase(),
    name: String(data.name || data.email || 'مستخدم جوجل'),
    emailVerified: true,
  };
}
