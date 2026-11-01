'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, ShieldCheck, ShieldX, Smartphone } from 'lucide-react';
import './qr-login.css';

/**
 * New device: "sign in with your phone". Shows a one-time QR, then the number
 * to pick on the phone, then opens the session the phone approved (its own
 * account, or the one the Super Admin's phone chose).
 * Server side: /api/auth/qr-login (see lib/qr-login.ts).
 */

type State =
  | { kind: 'loading' }
  | { kind: 'pending'; qr: string; shortCode: string; expiresAt: number }
  | { kind: 'scanned'; pairNumber: number; expiresAt: number }
  | { kind: 'success'; name: string }
  | { kind: 'denied' }
  | { kind: 'stale' }
  | { kind: 'error'; message: string };

/** The QR renews itself a few times, then waits for a tap (an unattended screen stops asking the server). */
const AUTO_RENEWALS = 4;

export default function QrDeviceLogin({ onSuccess, onBack }: { onSuccess: (data: any) => void; onBack: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const run = useRef(0);
  const renewals = useRef(0);
  const aborter = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    const id = ++run.current;
    aborter.current?.abort();
    const ctrl = new AbortController();
    aborter.current = ctrl;
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/auth/qr-login', { method: 'POST', cache: 'no-store', signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) throw new Error(data.error || 'تعذّر إنشاء رمز الدخول.');
      const link = `${window.location.origin}/link-device#c=${encodeURIComponent(data.code)}`;
      const qr = await QRCode.toDataURL(link, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 480,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      if (id !== run.current) return;
      setState({ kind: 'pending', qr, shortCode: data.shortCode, expiresAt: data.expiresAt });

      // Long-poll until the phone answers or the code runs out.
      let since = 'pending';
      while (id === run.current) {
        const poll = await fetch(`/api/auth/qr-login?since=${since}`, { cache: 'no-store', signal: ctrl.signal });
        if (id !== run.current) return;
        if (poll.status === 204) continue;
        const s = await poll.json().catch(() => ({}));
        if (s.status === 'SUCCESS') {
          setState({ kind: 'success', name: s.user?.name || '' });
          window.setTimeout(() => onSuccess(s), 900);
          return;
        }
        if (s.status === 'scanned') {
          setState({ kind: 'scanned', pairNumber: s.pairNumber, expiresAt: s.expiresAt });
        } else if (s.status === 'denied') {
          setState({ kind: 'denied' });
          return;
        } else if (s.status === 'expired' || s.status === 'none') {
          if (renewals.current < AUTO_RENEWALS) {
            renewals.current += 1;
            void start();
          } else {
            setState({ kind: 'stale' });
          }
          return;
        } else if (!poll.ok) {
          throw new Error(s.error || 'انقطع الاتصال بالخادم.');
        }
        since = s.status || since;
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' || id !== run.current) return;
      setState({ kind: 'error', message: (err as Error)?.message || 'تعذّر الاتصال بالخادم.' });
    }
  }, [onSuccess]);

  useEffect(() => {
    void start();
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      run.current += 1;
      aborter.current?.abort();
      window.clearInterval(tick);
    };
  }, [start]);

  const restart = () => {
    renewals.current = 0;
    void start();
  };

  const left = 'expiresAt' in state ? Math.max(0, Math.ceil((state.expiresAt - now) / 1000)) : 0;
  const total = state.kind === 'scanned' ? 180 : 120;

  return (
    <div className="qrl" dir="rtl">
      {state.kind === 'success' ? (
        <div className="qrl-result is-ok" role="status">
          <CheckCircle2 className="qrl-result-icon" />
          <strong>تم التأكيد من الهاتف</strong>
          <p>{state.name ? `جاري فتح حساب ${state.name}…` : 'جاري فتح الحساب…'}</p>
        </div>
      ) : state.kind === 'denied' ? (
        <div className="qrl-result is-bad" role="alert">
          <ShieldX className="qrl-result-icon" />
          <strong>رُفض الدخول من الهاتف</strong>
          <p>لم يُفتح أي حساب على هذا الجهاز.</p>
          <button type="button" className="qrl-btn" onClick={restart}><RefreshCw className="w-4 h-4" /> رمز جديد</button>
        </div>
      ) : state.kind === 'error' ? (
        <div className="qrl-result is-bad" role="alert">
          <ShieldX className="qrl-result-icon" />
          <strong>تعذّر عرض الرمز</strong>
          <p>{state.message}</p>
          <button type="button" className="qrl-btn" onClick={restart}><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
        </div>
      ) : state.kind === 'scanned' ? (
        <div className="qrl-match" role="status" aria-live="polite">
          <span className="qrl-match-label">تم المسح — اختر هذا الرقم على هاتفك</span>
          <span className="qrl-match-number" dir="ltr">{state.pairNumber}</span>
          <span className="qrl-wait"><Loader2 className="w-4 h-4 animate-spin" /> بانتظار التأكيد من الهاتف… <b dir="ltr">{left}s</b></span>
        </div>
      ) : (
        <>
          <div className={`qrl-frame${state.kind === 'stale' ? ' is-stale' : ''}`}>
            <span className="qrl-corner is-tl" /><span className="qrl-corner is-tr" />
            <span className="qrl-corner is-bl" /><span className="qrl-corner is-br" />
            {state.kind === 'pending' ? (
              <>
                <img src={state.qr} alt="رمز QR للدخول بالهاتف" className="qrl-img" />
                <span className="qrl-scanline" aria-hidden />
              </>
            ) : (
              <span className="qrl-skeleton"><Loader2 className="w-6 h-6 animate-spin" /></span>
            )}
            {state.kind === 'stale' ? (
              <button type="button" className="qrl-stale" onClick={restart}>
                <RefreshCw className="w-5 h-5" /> انقر لعرض رمز جديد
              </button>
            ) : null}
          </div>

          {state.kind === 'pending' ? (
            <div className="qrl-meta">
              <span className="qrl-timer" style={{ ['--p' as string]: `${(left / total) * 100}%` }} aria-label={`صالح ${left} ثانية`}>
                <b dir="ltr">{left}</b>
              </span>
              <span className="qrl-code">
                أو أدخل الرمز: <b dir="ltr">{state.shortCode}</b>
              </span>
            </div>
          ) : null}

          <ol className="qrl-steps">
            <li><Smartphone className="w-4 h-4" /> افتح الموقع على هاتفك وأنت مسجّل الدخول</li>
            <li><ShieldCheck className="w-4 h-4" /> اضغط «ربط جهاز» من قائمة حسابك أو لوحة الإدارة</li>
            <li>وجّه الكاميرا نحو الرمز واختر الرقم الظاهر هنا</li>
          </ol>
        </>
      )}

      <button type="button" className="qrl-back" onClick={onBack}>
        <ArrowRight className="w-4 h-4" /> الدخول بكلمة المرور
      </button>
    </div>
  );
}
