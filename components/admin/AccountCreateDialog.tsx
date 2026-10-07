'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react';
import { LOGIN_ROLE_LABELS, type LoginRole } from '@/lib/roles';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';

const ROLE_HELP: Record<LoginRole, string> = {
  SUPER_ADMIN: '',
  AGENCY_MANAGER: 'يدير الحجوزات والبرامج والطاقم. يدخل بكلمة مرور + مفتاح أمان.',
  ACCOUNTANT: 'المالية، العربون، الوصولات والتقارير.',
  GUIDE_MURSHID: 'لوحة المرشد والمناسك ومجموعات المعتمرين.',
  AGENCY_AGENT: 'خدمة العملاء ومتابعة الطلبات.',
  PILGRIM_USER: 'حساب معتمر: برنامجه، وثائقه، ومدفوعاته.',
};

type Result =
  | { kind: 'credentials'; username: string; password?: string; message: string }
  | { kind: 'invite'; url: string; minutes: number; message: string };

function strongPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b, i) => (i < sets.length ? sets[i] : all)[b % (i < sets.length ? sets[i] : all).length]);
  // Shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="acd-copy">
      <span>{label}</span>
      <code dir="ltr">{value}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            /* clipboard blocked */
          }
        }}
        aria-label={`نسخ ${label}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AccountCreateDialog({
  assignableRoles,
  onClose,
  onCreated,
}: {
  assignableRoles: LoginRole[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const roles = assignableRoles.filter((r) => r !== 'SUPER_ADMIN');
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    role: (roles.includes('PILGRIM_USER') ? 'PILGRIM_USER' : roles[0]) as LoginRole,
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const privileged = form.role === 'AGENCY_MANAGER';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const problems = useMemo(() => {
    const p: Record<string, string> = {};
    if (!form.name.trim()) p.name = 'الاسم مطلوب';
    if (!form.username.trim() && !form.email.trim()) p.username = 'اسم المستخدم أو البريد مطلوب';
    if (form.username && !/^[a-z0-9._-]{3,40}$/i.test(form.username)) p.username = 'حروف لاتينية وأرقام و . _ - (3 أحرف على الأقل)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) p.email = 'بريد غير صالح';
    if (!privileged && form.password && form.password.length < 8) p.password = '8 أحرف على الأقل، أو اتركها فارغة لتوليدها';
    return p;
  }, [form, privileged]);

  const valid = Object.keys(problems).length === 0;
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, password: privileged ? undefined : form.password || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر إنشاء الحساب');
      setResult(
        data.invite
          ? { kind: 'invite', url: data.invite.url, minutes: data.invite.expiresInMinutes, message: data.message }
          : { kind: 'credentials', username: data.credentials?.username, password: data.credentials?.password, message: data.message }
      );
      onCreated();
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acd" role="dialog" aria-modal="true" aria-labelledby="acd-title" dir="rtl">
      <button type="button" className="acd-bg" aria-label="إغلاق" onClick={() => !busy && onClose()} />
      <div className="acd-card">
        <header className="acd-head">
          <span className="acd-icon"><UserPlus className="w-5 h-5" aria-hidden /></span>
          <div>
            <h3 id="acd-title">{result ? 'تم إنشاء الحساب' : 'حساب جديد'}</h3>
            <p>{result ? result.message : 'اختر الدور ثم أدخل بيانات صاحب الحساب.'}</p>
          </div>
          <button type="button" className="acd-x" onClick={onClose} disabled={busy} aria-label="إغلاق"><X className="w-4 h-4" /></button>
        </header>

        {result ? (
          <div className="acd-body">
            {result.kind === 'invite' ? (
              <>
                <div className="acd-note is-key">
                  <KeyRound className="w-4 h-4" aria-hidden />
                  أرسل الرابط للمشرف عبر قناة آمنة. صالح لمرة واحدة خلال {Math.round(result.minutes / 60)} ساعة — يعيّن فيه كلمة المرور ويسجّل مفتاح الأمان.
                </div>
                <CopyField label="رابط التفعيل" value={result.url} />
              </>
            ) : (
              <>
                <div className="acd-note">تظهر كلمة المرور مرة واحدة فقط. سلّمها لصاحب الحساب واطلب منه تغييرها.</div>
                <CopyField label="اسم المستخدم" value={result.username} />
                {result.password ? <CopyField label="كلمة المرور" value={result.password} /> : null}
              </>
            )}
            <div className="acd-acts">
              <button type="button" className="acd-primary" onClick={onClose}>تم</button>
            </div>
          </div>
        ) : (
          <form className="acd-body" onSubmit={submit} noValidate>
            <fieldset className="acd-roles">
              <legend>الدور</legend>
              {roles.map((r) => (
                <label key={r} className={`acd-role${form.role === r ? ' is-on' : ''}${r === 'AGENCY_MANAGER' ? ' is-priv' : ''}`}>
                  <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => set({ role: r })} />
                  <strong>
                    {r === 'AGENCY_MANAGER' ? <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> : null}
                    {LOGIN_ROLE_LABELS[r]}
                  </strong>
                  <span>{ROLE_HELP[r]}</span>
                </label>
              ))}
            </fieldset>

            <div className="acd-grid">
              <label className={touched && problems.name ? 'is-bad' : ''}>
                الاسم الكامل
                <input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} autoFocus />
                {touched && problems.name ? <em>{problems.name}</em> : null}
              </label>
              <label className={touched && problems.username ? 'is-bad' : ''}>
                اسم المستخدم
                <input dir="ltr" value={form.username} onChange={(e) => set({ username: e.target.value.trim().toLowerCase() })} maxLength={40} autoComplete="off" />
                {touched && problems.username ? <em>{problems.username}</em> : null}
              </label>
              <label className={touched && problems.email ? 'is-bad' : ''}>
                البريد الإلكتروني
                <input dir="ltr" type="email" value={form.email} onChange={(e) => set({ email: e.target.value.trim() })} maxLength={160} autoComplete="off" />
                {touched && problems.email ? <em>{problems.email}</em> : null}
              </label>
              <label>
                الهاتف
                <input dir="ltr" value={form.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} inputMode="tel" />
              </label>
            </div>

            {privileged ? (
              <div className="acd-note is-key">
                <KeyRound className="w-4 h-4" aria-hidden />
                لا تُعيَّن كلمة مرور هنا. سيصدر رابط تفعيل يعيّن فيه المشرف كلمة المرور ويسجّل مفتاح الأمان. ستحتاج إلى لمس مفتاحك لتأكيد الإنشاء.
              </div>
            ) : (
              <label className={`acd-pass${touched && problems.password ? ' is-bad' : ''}`}>
                كلمة المرور (اختياري)
                <span>
                  <input dir="ltr" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder="تُولَّد تلقائياً إن تُركت فارغة" maxLength={128} autoComplete="new-password" />
                  <button type="button" onClick={() => set({ password: strongPassword() })} aria-label="توليد كلمة مرور قوية">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </span>
                {touched && problems.password ? <em>{problems.password}</em> : null}
              </label>
            )}

            {error ? <p className="acd-error" role="alert">{error}</p> : null}

            <div className="acd-acts">
              <button type="submit" className="acd-primary" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                {privileged ? 'إنشاء وإصدار رابط التفعيل' : 'إنشاء الحساب'}
              </button>
              <button type="button" className="acd-ghost" onClick={onClose} disabled={busy}>إلغاء</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Shows a freshly issued Admin activation link once. */
export function InviteLinkDialog({ url, minutes, title, onClose }: { url: string; minutes: number; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="acd" role="dialog" aria-modal="true" aria-labelledby="acd-invite-title" dir="rtl">
      <button type="button" className="acd-bg" aria-label="إغلاق" onClick={onClose} />
      <div className="acd-card is-narrow">
        <header className="acd-head">
          <span className="acd-icon"><KeyRound className="w-5 h-5" aria-hidden /></span>
          <div>
            <h3 id="acd-invite-title">{title}</h3>
            <p>صالح لمرة واحدة خلال {Math.round(minutes / 60)} ساعة. أرسله عبر قناة آمنة.</p>
          </div>
          <button type="button" className="acd-x" onClick={onClose} aria-label="إغلاق"><X className="w-4 h-4" /></button>
        </header>
        <div className="acd-body">
          <CopyField label="رابط التفعيل" value={url} />
          <div className="acd-acts">
            <button type="button" className="acd-primary" onClick={onClose}>تم</button>
          </div>
        </div>
      </div>
    </div>
  );
}
