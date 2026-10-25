'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { enterSessionAndReload } from '@/lib/client-session';

/**
 * Opened from an account sign-in QR (/app#ssqr=SSQR1…, lib/login-qr.ts): signs
 * in with it and goes to the account. The code is removed from the address bar
 * before anything else, so it stays out of the browser history.
 */
export default function QrLinkSignIn() {
  const [state, setState] = useState<null | { kind: 'busy' | 'ok' | 'bad'; text: string }>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const m = hash.match(/ssqr=([^&]+)/);
    if (!m) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const qrPayload = decodeURIComponent(m[1]);
    setState({ kind: 'busy', text: 'جاري الدخول برمز QR…' });
    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrPayload }),
    })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (d.status === 'SUCCESS') {
          setState({ kind: 'ok', text: `مرحباً ${d.user?.name || ''}` });
          const next = d.user?.role === 'SUPER_ADMIN' || d.user?.role === 'AGENCY_MANAGER' ? '/admin' : d.user?.redirect || '/portal';
          window.setTimeout(() => enterSessionAndReload(d.token, d.user, next), 500);
          return;
        }
        if (d.status === 'REQUIRES_SECURITY_KEY' || d.status === 'ENROLLMENT_REQUIRED') {
          setState({ kind: 'bad', text: 'حسابات الإدارة تدخل بكلمة المرور ومفتاح الأمان، لا برمز QR.' });
          return;
        }
        if (d.status === 'PENDING_APPROVAL') {
          setState({ kind: 'bad', text: 'الحساب بانتظار تفعيل الوكالة.' });
          return;
        }
        setState({ kind: 'bad', text: d.error || 'هذا الرمز لم يعد يعمل — اطلب رمزاً جديداً من الوكالة.' });
      })
      .catch(() => setState({ kind: 'bad', text: 'تعذّر الاتصال — حاول مرة أخرى.' }));
  }, []);

  if (!state) return null;
  return (
    <div className="qrls" role="status" dir="rtl">
      <div className={`qrls-card is-${state.kind}`}>
        {state.kind === 'busy' ? <Loader2 className="animate-spin" aria-hidden /> : state.kind === 'ok' ? <CheckCircle2 aria-hidden /> : <ShieldAlert aria-hidden />}
        <p>{state.text}</p>
        {state.kind === 'bad' ? <button type="button" onClick={() => setState(null)}>حسناً</button> : null}
      </div>
    </div>
  );
}
