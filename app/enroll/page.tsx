'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Copy, Download, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { checkPrivilegedPassword } from '@/lib/password-policy';
import { createKey, keyErrorMessage, securityKeysSupported } from '@/lib/webauthn-client';

type Info = { name: string; username: string; roleLabel: string; reason: string };
type Step = 'password' | 'key' | 'codes';

const STEPS: { id: Step; label: string }[] = [
  { id: 'password', label: 'كلمة المرور' },
  { id: 'key', label: 'مفتاح الأمان' },
  { id: 'codes', label: 'رموز الاسترداد' },
];

function EnrollInner() {
  const token = useSearchParams().get('t') || '';
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState('مفتاح الأمان الرئيسي');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const supported = securityKeysSupported();

  useEffect(() => {
    if (!token) {
      setLoadError('رابط التفعيل ناقص.');
      return;
    }
    fetch(`/api/auth/enroll?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'رابط التفعيل غير صالح');
        setInfo(data);
      })
      .catch((err) => setLoadError(err.message));
  }, [token]);

  const policy = useMemo(() => checkPrivilegedPassword(password, info?.username), [password, info?.username]);
  const matches = password.length > 0 && password === confirm;

  const registerKey = async (kind: 'platform' | 'cross-platform') => {
    const keyLabel = kind === 'platform' && label === 'مفتاح الأمان الرئيسي' ? 'Windows Hello — هذا الحاسوب' : label;
    setBusy(true);
    setError('');
    try {
      const startRes = await fetch('/api/auth/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'options', t: token, password, kind }),
      });
      const start = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new Error(start.error || 'تعذّر بدء التسجيل');
      const response = await createKey(start.options);
      const doneRes = await fetch('/api/auth/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', t: token, password, flowToken: start.flowToken, response, label: keyLabel }),
      });
      const done = await doneRes.json().catch(() => ({}));
      if (!doneRes.ok) throw new Error(done.error || 'تعذّر حفظ المفتاح');
      setCodes(done.recoveryCodes || []);
      setPassword('');
      setConfirm('');
      setStep('codes');
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const codesText = () =>
    [`South Street — رموز الاسترداد (${info?.username || ''})`, `صدرت: ${new Date().toLocaleString('ar-DZ')}`, '', ...codes, '', 'كل رمز يُستعمل مرة واحدة فقط.'].join('\n');

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codesText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const downloadCodes = () => {
    const blob = new Blob([codesText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `south-street-recovery-codes-${info?.username || 'account'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <main className="enr" dir="rtl">
      <div className="enr-card">
        <div className="enr-brand"><BrandLogo /></div>

        {loadError ? (
          <div className="enr-state">
            <span className="enr-state-icon is-bad"><X className="w-6 h-6" aria-hidden /></span>
            <h1>تعذّر فتح رابط التفعيل</h1>
            <p>{loadError}</p>
            <p className="enr-muted">الروابط تُستعمل مرة واحدة ولها مدة صلاحية. اطلب رابطاً جديداً من المشرف العام.</p>
          </div>
        ) : !info ? (
          <div className="enr-state"><Loader2 className="w-6 h-6 animate-spin" aria-hidden /> جاري التحقق من الرابط...</div>
        ) : (
          <>
            <header className="enr-head">
              <h1>تفعيل حساب الإدارة</h1>
              <p>
                <b>{info.name}</b> · <span dir="ltr">{info.username}</span> · {info.roleLabel}
              </p>
            </header>

            <ol className="enr-steps" aria-label="مراحل التفعيل">
              {STEPS.map((s, i) => (
                <li key={s.id} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-on' : ''}>
                  <span>{i < stepIndex ? <Check className="w-3.5 h-3.5" aria-hidden /> : i + 1}</span>
                  {s.label}
                </li>
              ))}
            </ol>

            {error ? <p className="enr-error" role="alert">{error}</p> : null}

            {step === 'password' ? (
              <form
                className="enr-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (policy.ok && matches) setStep('key');
                }}
              >
                <label>
                  كلمة المرور الجديدة
                  <span className="enr-field">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                      maxLength={128}
                      required
                      autoFocus
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'إخفاء' : 'إظهار'}>
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </span>
                </label>
                <div className={`enr-meter is-${policy.score}`} aria-hidden><i /><i /><i /><i /></div>
                <ul className="enr-rules">
                  {([
                    ['length', '12 حرفاً على الأقل'],
                    ['letter', 'حرف واحد على الأقل'],
                    ['digit', 'رقم واحد على الأقل'],
                    ['symbol', 'رمز واحد على الأقل (مثل ! @ #)'],
                  ] as const).map(([key, rule]) => (
                    <li key={key} className={policy.rules[key] ? 'is-ok' : ''}>
                      <Check className="w-3.5 h-3.5" aria-hidden /> {rule}
                    </li>
                  ))}
                </ul>
                <label>
                  تأكيد كلمة المرور
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    maxLength={128}
                    required
                  />
                </label>
                {confirm && !matches ? <p className="enr-hint is-bad">كلمتا المرور غير متطابقتين</p> : null}
                <button type="submit" className="enr-primary" disabled={!policy.ok || !matches}>
                  متابعة
                </button>
              </form>
            ) : null}

            {step === 'key' ? (
              <div className="enr-form">
                <div className="enr-key-hero">
                  <span className={`enr-key-icon${busy ? ' is-busy' : ''}`}>
                    {busy ? <Loader2 className="w-8 h-8 animate-spin" aria-hidden /> : <KeyRound className="w-8 h-8" aria-hidden />}
                  </span>
                  <p>
                    اختر طريقة التحقق. مع Windows Hello يطلب منك الجهاز رمز PIN أو البصمة أو الوجه.
                  </p>
                </div>
                <label>
                  اسم المفتاح
                  <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
                </label>
                {!supported ? <p className="enr-error">هذا المتصفح لا يدعم مفاتيح الأمان. استعمل Chrome أو Edge أو Safari حديثاً.</p> : null}
                <button
                  type="button"
                  className="enr-primary"
                  onClick={() => void registerKey('platform')}
                  disabled={busy || !supported}
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden />
                  {busy ? 'بانتظار التأكيد...' : 'Windows Hello على هذا الحاسوب'}
                </button>
                <button
                  type="button"
                  className="enr-secondary"
                  onClick={() => void registerKey('cross-platform')}
                  disabled={busy || !supported}
                >
                  <KeyRound className="w-4 h-4" aria-hidden />
                  مفتاح USB (YubiKey) أو الهاتف
                </button>
                <button type="button" className="enr-link" onClick={() => setStep('password')} disabled={busy}>
                  رجوع
                </button>
              </div>
            ) : null}

            {step === 'codes' ? (
              <div className="enr-form">
                <div className="enr-done">
                  <span className="enr-state-icon is-good"><LockKeyhole className="w-6 h-6" aria-hidden /></span>
                  <div>
                    <strong>تم تفعيل الحساب بمفتاح الأمان</strong>
                    <p>احفظ رموز الاسترداد الآن — لن تظهر مرة أخرى. كل رمز يُستعمل مرة واحدة إذا فقدت مفتاحك.</p>
                  </div>
                </div>
                <ol className="enr-codes" dir="ltr">
                  {codes.map((c) => <li key={c}>{c}</li>)}
                </ol>
                <div className="enr-code-acts">
                  <button type="button" onClick={copyCodes}>
                    {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
                    {copied ? 'تم النسخ' : 'نسخ'}
                  </button>
                  <button type="button" onClick={downloadCodes}>
                    <Download className="w-4 h-4" aria-hidden /> تنزيل ملف نصي
                  </button>
                </div>
                <label className="enr-check">
                  <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
                  حفظت الرموز في مكان آمن خارج هذا الجهاز
                </label>
                <p className="enr-hint">ننصح بتسجيل مفتاح ثانٍ احتياطي من «أمان الحساب» بعد الدخول.</p>
                <Link href="/admin" className={`enr-primary${saved ? '' : ' is-disabled'}`} aria-disabled={!saved} onClick={(e) => { if (!saved) e.preventDefault(); }}>
                  الذهاب إلى تسجيل الدخول
                </Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<main className="enr"><div className="enr-card"><div className="enr-state">جاري التحميل...</div></div></main>}>
      <EnrollInner />
    </Suspense>
  );
}
