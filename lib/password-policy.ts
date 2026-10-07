/** Password rules for Super Admin / Admin accounts. Shared by the enrollment page and the API. */

export const PRIVILEGED_PASSWORD_MIN = 12;

export type PasswordRules = { length: boolean; letter: boolean; digit: boolean; symbol: boolean };
export type PasswordCheck = { ok: boolean; errors: string[]; score: 0 | 1 | 2 | 3 | 4; rules: PasswordRules };

export function checkPrivilegedPassword(password: string, username = ''): PasswordCheck {
  const pw = String(password || '');
  const errors: string[] = [];
  const rules: PasswordRules = {
    length: pw.length >= PRIVILEGED_PASSWORD_MIN,
    letter: /[A-Za-z\u0600-\u06FF]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9\u0600-\u06FF]/.test(pw),
  };
  if (!rules.length) errors.push(`${PRIVILEGED_PASSWORD_MIN} حرفاً على الأقل`);
  if (!rules.letter) errors.push('حرف واحد على الأقل');
  if (!rules.digit) errors.push('رقم واحد على الأقل');
  if (!rules.symbol) errors.push('رمز واحد على الأقل (مثل ! @ #)');
  if (pw.length > 128) errors.push('128 حرفاً كحد أقصى');
  const user = String(username || '').trim().toLowerCase();
  if (user.length >= 3 && pw.toLowerCase().includes(user)) errors.push('لا يحتوي على اسم المستخدم');

  let score = 0;
  if (pw.length >= PRIVILEGED_PASSWORD_MIN) score += 1;
  if (pw.length >= 16) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return { ok: errors.length === 0, errors, score: Math.min(4, score) as PasswordCheck['score'], rules };
}
