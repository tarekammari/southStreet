'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { useBrand } from '@/components/social/useAgencyInfo';

type Phase =
  | { kind: 'loading' }
  | { kind: 'qr'; src: string; expiresAt: number }
  | { kind: 'scanned'; name: string; avatar?: string; match: number }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const POLL_MS = 2000;

/**
 * Sign in on this computer with a phone that is already signed in
 * (lib/qr-login.ts): show a QR, the phone scans it and taps the number shown
 * here, then this computer receives the session.
 */
export default function PhoneSignInPanel({ onSuccess, onBack }: { onSuccess: (data: any) => void; onBack: () => void }) {
  const brand = useBrand();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [now, setNow] = useState(Date.now());
  const req = useRef<{ id: string; key: string } | null>(null);
  const done = useRef(false);

  const start = useCallback(async () => {
    setPhase({ kind: 'loading' });
    req.current = null;
    try {
      const res = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'تعذّر إنشاء الرمز');
      const link = `${window.location.origin}/qr-login?r=${encodeURIComponent(d.id)}`;
      const src = await QRCode.toDataURL(link, { errorCorrectionLevel: 'H', margin: 1, width: 440, color: { dark: '#0f172a', light: '#ffffff' } });
      req.current = { id: d.id, key: d.pollKey };
      setPhase({ kind: 'qr', src, expiresAt: d.expiresAt });
    } catch (e: any) {
      setPhase({ kind: 'error', message: e?.message || 'تعذّر الاتصال' });
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  // Poll while a request is open; the server hands the session out once.
  useEffect(() => {
    if (phase.kind !== 'qr' && phase.kind !== 'scanned') return;
    let stop = false;
    const tick = async () => {
      const r = req.current;
      if (stop || !r || done.current) return;
      try {
        const res = await fetch(`/api/auth/qr-login?id=${encodeURIComponent(r.id)}&key=${encodeURIComponent(r.key)}`, { cache: 'no-store' });
        const d = await res.json();
        if (stop) return;
        if (d.status === 'SUCCESS') {
          done.current = true;
          setPhase({ kind: 'success' });
          window.setTimeout(() => onSuccess(d), 700);
          return;
        }
        if (d.status === 'SCANNED') {
          setPhase((p) => (p.kind === 'scanned' && p.match === d.match ? p : { kind: 'scanned', name: d.name, avatar: d.avatar, match: d.match }));
        } else if (d.status === 'DENIED') {
          setPhase({ kind: 'denied' });
          return;
        } else if (d.status === 'EXPIRED') {
          setPhase({ kind: 'expired' });
          return;
        }
      } catch {
        /* network blip: try again */
      }
      if (!stop) window.setTimeout(tick, POLL_MS);
    };
    const t = window.setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [phase.kind, onSuccess]);

  // Countdown ring; a fresh code is made when the old one runs out.
  useEffect(() => {
    if (phase.kind !== 'qr') return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= phase.expiresAt) void start();
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, start]);

  const left = phase.kind === 'qr' ? Math.max(0, Math.round((phase.expiresAt - now) / 1000)) : 0;

  return (
    <div className="psi" dir="rtl">
      {phase.kind === 'scanned' ? (
        <div className="psi-scanned" role="status">
          <span className="psi-avatar">{phase.avatar && /^(https?:|\/)/.test(phase.avatar) ? <img src={phase.avatar} alt="" /> : (phase.name || '؟').trim().charAt(0)}</span>
          <strong>{phase.name}</strong>
          <p>اختر هذا الرقم على هاتفك لتأكيد الدخول</p>
          <span className="psi-match" aria-label={`الرقم ${phase.match}`}>{phase.match}</span>
          <small><Loader2 className="animate-spin" aria-hidden /> بانتظار التأكيد من الهاتف…</small>
        </div>
      ) : phase.kind === 'success' ? (
        <div className="psi-state is-ok" role="status">
          <CheckCircle2 aria-hidden />
          <strong>تم التأكيد — جاري الدخول…</strong>
        </div>
      ) : phase.kind === 'denied' || phase.kind === 'expired' || phase.kind === 'error' ? (
        <div className="psi-state is-bad" role="alert">
          <XCircle aria-hidden />
          <strong>
            {phase.kind === 'denied' ? 'أُلغي الطلب من الهاتف' : phase.kind === 'expired' ? 'انتهت صلاحية الرمز' : phase.message}
          </strong>
          <button type="button" className="login-simple-submit" onClick={() => void start()}>
            <RefreshCw aria-hidden /> رمز جديد
          </button>
        </div>
      ) : (
        <>
          <div className={`psi-qr${phase.kind === 'loading' ? ' is-loading' : ''}`}>
            {phase.kind === 'qr' ? <img src={phase.src} alt="رمز QR للدخول بالهاتف" /> : <Loader2 className="animate-spin" aria-hidden />}
            {phase.kind === 'qr' ? (
              <span className="psi-logo" aria-hidden><img src={brand.mark_url} alt="" /></span>
            ) : null}
          </div>
          {phase.kind === 'qr' ? (
            <p className="psi-timer">
              <span style={{ ['--p' as string]: `${(left / 120) * 100}%` }} aria-hidden /> يتجدّد الرمز بعد {left} ث
            </p>
          ) : null}
          <ol className="psi-steps">
            <li><Smartphone aria-hidden /> افتح الموقع أو تطبيق {brand.name_latin} على هاتفك وتأكد أنك داخل حسابك</li>
            <li>امسح الرمز بكاميرا الهاتف، أو من القائمة: «ربط جهاز كمبيوتر»</li>
            <li>اختر على الهاتف الرقم الذي يظهر هنا</li>
          </ol>
          <p className="psi-note"><ShieldCheck aria-hidden /> لا تُرسل كلمة المرور. الرمز صالح لمرة واحدة ولمدة دقيقتين.</p>
        </>
      )}
      <button type="button" className="login-simple-switch" onClick={onBack}>الدخول بكلمة المرور</button>
    </div>
  );
}
