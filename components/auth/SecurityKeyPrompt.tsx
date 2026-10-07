'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { assertWithKey, keyErrorMessage, securityKeysSupported } from '@/lib/webauthn-client';

type LoginSuccess = { token: string; user: any; recoveryCodesLeft?: number; [k: string]: unknown };

/**
 * Second sign-in step for Super Admin / Admin: touch the security key, or use
 * a one-time recovery code. Starts the key prompt automatically once.
 */
export default function SecurityKeyPrompt({
  flowToken,
  options,
  name,
  tone = 'light',
  onSuccess,
  onCancel,
}: {
  flowToken: string;
  options: any;
  name?: string;
  tone?: 'light' | 'dark';
  onSuccess: (data: LoginSuccess) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const started = useRef(false);
  const supported = securityKeysSupported();

  const finish = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/auth/webauthn/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowToken, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'SUCCESS') throw new Error(data.error || 'تعذّر إكمال الدخول');
    onSuccess(data);
  };

  const tapKey = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await assertWithKey(options);
      await finish({ response });
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await finish({ recoveryCode: code });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current || !supported) return;
    started.current = true;
    void tapKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`skp is-${tone}`} dir="rtl">
      <div className={`skp-badge${busy ? ' is-busy' : ''}`} aria-hidden>
        {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <KeyRound className="w-7 h-7" />}
      </div>
      <h3 className="skp-title">تأكيد الهوية بمفتاح الأمان</h3>
      <p className="skp-text">
        {name ? <><b>{name}</b> — </> : null}
        أدخل مفتاح الأمان أو استعمل بصمة الجهاز، ثم المسه عند الطلب.
      </p>

      {error ? <p className="skp-error" role="alert">{error}</p> : null}

      {!recovery ? (
        <>
          <button type="button" className="skp-primary" onClick={tapKey} disabled={busy || !supported}>
            <ShieldCheck className="w-4 h-4" aria-hidden />
            {busy ? 'بانتظار المفتاح...' : 'استعمال مفتاح الأمان'}
          </button>
          {!supported ? <p className="skp-error">هذا المتصفح لا يدعم مفاتيح الأمان. استعمل رمز استرداد.</p> : null}
          <button type="button" className="skp-link" onClick={() => { setRecovery(true); setError(''); }}>
            فقدت المفتاح؟ استعمل رمز استرداد
          </button>
        </>
      ) : (
        <form onSubmit={submitRecovery} className="skp-form">
          <label>
            رمز الاسترداد
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXX-XXXXX"
              dir="ltr"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={11}
              required
              autoFocus
            />
          </label>
          <button type="submit" className="skp-primary" disabled={busy || code.replace(/[^A-Z0-9]/g, '').length !== 10}>
            {busy ? 'جاري التحقق...' : 'دخول برمز الاسترداد'}
          </button>
          <button type="button" className="skp-link" onClick={() => { setRecovery(false); setError(''); }}>
            العودة إلى مفتاح الأمان
          </button>
        </form>
      )}

      <button type="button" className="skp-link is-muted" onClick={onCancel}>إلغاء والعودة</button>
    </div>
  );
}
