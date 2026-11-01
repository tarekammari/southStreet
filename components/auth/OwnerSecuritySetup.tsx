'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Fingerprint, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { adminFetch, createKey, keyErrorMessage, securityKeysSupported } from '@/lib/webauthn-client';
import './owner-setup.css';

/**
 * Dashboard card for the Super Admin until the account is fully protected:
 *   1. no key yet        → make this phone's fingerprint / face the key;
 *   2. no recovery codes → issue and save them (for a lost phone);
 *   3. only one key      → suggest a backup key on the computer (dismissible).
 * Uses the same API as SecurityKeysPanel (/api/account/security-keys).
 */

type Step = 'loading' | 'fingerprint' | 'codes' | 'backup' | 'done';

const DISMISS_KEY = 'ss_owner_backup_hint_dismissed';

function thisDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iphone|ipad/i.test(ua)) return 'بصمة / وجه iPhone';
  if (/android/i.test(ua)) return 'بصمة هاتف Android';
  if (/windows/i.test(ua)) return 'Windows Hello';
  if (/mac os/i.test(ua)) return 'Touch ID';
  return 'بصمة هذا الجهاز';
}

export default function OwnerSecuritySetup() {
  const [step, setStep] = useState<Step>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/account/security-keys', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setStep('done');
      const keys = (data.keys || []).length;
      const codesLeft = Number(data.recoveryCodesLeft) || 0;
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === '1';
      } catch {
        /* storage blocked */
      }
      setStep(keys === 0 ? 'fingerprint' : codesLeft === 0 ? 'codes' : keys === 1 && !dismissed ? 'backup' : 'done');
    } catch {
      setStep('done');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addFingerprint = () =>
    run(async () => {
      const startRes = await adminFetch('/api/account/security-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'options', kind: 'platform' }),
      });
      const start = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new Error(start.error || 'تعذّر بدء التفعيل');
      const response = await createKey(start.options);
      const doneRes = await adminFetch('/api/account/security-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', flowToken: start.flowToken, response, label: thisDeviceName() }),
      });
      const done = await doneRes.json().catch(() => ({}));
      if (!doneRes.ok) throw new Error(done.error || 'تعذّر حفظ البصمة');
      await load();
    });

  const issueCodes = () =>
    run(async () => {
      // With a key now registered this asks for one fingerprint touch first.
      const res = await adminFetch('/api/account/security-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر إصدار الرموز');
      setCodes(data.recoveryCodes || []);
    });

  const downloadCodes = () => {
    const text = `رموز الاسترداد — ${window.location.host}\nكل رمز يُستعمل مرة واحدة إذا فقدت هاتفك.\n\n${codes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-codes-${window.location.hostname}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const dismissBackup = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage blocked */
    }
    setStep('done');
  };

  if (step === 'loading' || step === 'done') return null;

  return (
    <section className={`osec is-${step}`} dir="rtl" aria-live="polite">
      {step === 'fingerprint' ? (
        <>
          <span className="osec-icon"><Fingerprint className="w-7 h-7" /></span>
          <div className="osec-copy">
            <strong>اجعل بصمتك مفتاح الحساب</strong>
            <p>
              فعّل بصمة (أو وجه) هذا الهاتف: بعدها لا يفتح حساب المشرف العام إلا بـ Google + بصمتك، وتؤكّد دخول أي جهاز جديد
              بلمسة واحدة. حتى لو سُرق حساب Google فلن يدخل أحد بدون هاتفك.
            </p>
            {!securityKeysSupported() ? <p className="osec-error">هذا المتصفح لا يدعم البصمة. افتح الموقع في Chrome أو Safari.</p> : null}
            {error ? <p className="osec-error" role="alert">{error}</p> : null}
          </div>
          <button type="button" className="osec-btn" onClick={() => void addFingerprint()} disabled={busy}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />} تفعيل البصمة
          </button>
        </>
      ) : step === 'codes' ? (
        <>
          <span className="osec-icon"><KeyRound className="w-7 h-7" /></span>
          <div className="osec-copy">
            <strong>{codes.length ? 'احفظ هذه الرموز الآن' : 'خطوة أخيرة: رموز الاسترداد'}</strong>
            <p>
              {codes.length
                ? 'لن تظهر مرة أخرى. احفظها خارج هذا الهاتف (على الكمبيوتر أو مطبوعة). كل رمز يُدخلك مرة واحدة إن ضاع هاتفك.'
                : 'إن ضاع هاتفك، تُدخلك هذه الرموز مكان البصمة. ستُطلب منك لمسة بصمة لإصدارها.'}
            </p>
            {codes.length ? (
              <ol className="osec-codes" dir="ltr">
                {codes.map((c) => <li key={c}>{c}</li>)}
              </ol>
            ) : null}
            {error ? <p className="osec-error" role="alert">{error}</p> : null}
          </div>
          {codes.length ? (
            <div className="osec-actions">
              <button type="button" className="osec-btn is-ghost" onClick={downloadCodes}><Download className="w-4 h-4" /> تنزيل</button>
              <button type="button" className="osec-btn is-ghost" onClick={() => void copyCodes()}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'نُسخت' : 'نسخ'}
              </button>
              <button type="button" className="osec-btn" onClick={() => { setCodes([]); void load(); }}><ShieldCheck className="w-4 h-4" /> حفظتها</button>
            </div>
          ) : (
            <button type="button" className="osec-btn" onClick={() => void issueCodes()} disabled={busy}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />} إصدار الرموز
            </button>
          )}
        </>
      ) : (
        <>
          <span className="osec-icon"><ShieldCheck className="w-7 h-7" /></span>
          <div className="osec-copy">
            <strong>حسابك محمي ببصمتك ✓</strong>
            <p>نصيحة: أضف مفتاحاً احتياطياً على الكمبيوتر (Windows Hello) من «أمان الحساب»، حتى تبقى قادراً على الدخول إن تعطّل الهاتف.</p>
          </div>
          <button type="button" className="osec-close" onClick={dismissBackup} aria-label="إخفاء"><X className="w-4 h-4" /></button>
        </>
      )}
    </section>
  );
}
