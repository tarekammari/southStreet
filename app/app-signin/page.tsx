'use client';

/**
 * Sign-in for the Connect apps, opened in the phone's / PC's real browser:
 * Google refuses its sign-in inside apps, and security keys (Super Admin /
 * Admin) only work in a real browser. Once signed in here, the app is reopened
 * with a one-time code (see /api/auth/app-handoff) and gets the same session.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle2, KeyRound, Loader2, Smartphone, UserRound } from 'lucide-react';
import GoogleContinueButton from '@/components/GoogleContinueButton';
import { connectName } from '@/lib/brand';
import { useBrand } from '@/components/social/useAgencyInfo';

const LoginModal = dynamic(() => import('@/components/LoginModal'), { ssr: false });

function appLink(code: string, platform: string): string {
  const q = `signin?code=${encodeURIComponent(code)}`;
  // Android: an intent link opens exactly this app (and works from Chrome).
  return platform === 'android'
    ? `intent://${q}#Intent;scheme=ssconnect;package=tech.southstreet.connect;end`
    : `ssconnect://${q}`;
}

const btn: React.CSSProperties = {
  width: '100%', height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontWeight: 800, fontSize: '.95rem', textDecoration: 'none', cursor: 'pointer', border: 0, fontFamily: 'inherit',
};

export default function AppSignInPage() {
  const brand = useBrand();
  const [platform, setPlatform] = useState('android');
  const [me, setMe] = useState<{ name: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [link, setLink] = useState('');
  const [passwordLogin, setPasswordLogin] = useState(false);

  /** Hands the session of this browser to the app. */
  const handoff = useCallback(async (p: string) => {
    setBusy(true);
    setError('');
    try {
      const hand = await fetch('/api/auth/app-handoff', { method: 'POST' });
      const h = await hand.json();
      if (!hand.ok || !h.code) {
        setError(h.error || 'تعذر إكمال الدخول. أعد المحاولة.');
        return;
      }
      const href = appLink(h.code, p);
      setLink(href);
      window.location.href = href; // back to the app
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('platform') === 'windows' ? 'windows' : 'android';
    setPlatform(p);
    // Already signed in on this browser?
    fetch('/api/connect/config', { cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()).me as { name: string }) : null))
      .catch(() => null)
      .then((who) => {
        setMe(who || null);
        // Back here after password + security key: go straight to the app.
        if (who && q.get('auto') === '1') void handoff(p);
      });
  }, [handoff]);

  const onToken = async (accessToken: string) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: accessToken }),
      });
      const data = await res.json();
      if (data.status === 'PENDING_APPROVAL') {
        setInfo(data.message || 'حسابك قيد المراجعة. سنخبرك بعد موافقة الوكالة.');
        return;
      }
      if (!res.ok || data.status !== 'SUCCESS') {
        setError(data.error || 'تعذر الدخول عبر جوجل');
        return;
      }
      await handoff(platform);
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      dir="rtl"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f5', fontFamily: 'var(--font-tajawal), Tajawal, system-ui, sans-serif' }}
    >
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '28px 22px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 24px 48px -24px rgba(15,23,42,.25)' }}>
        <img src="/icons/connect-192.png" alt="" style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 10px' }} />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#065f46' }}>الدخول إلى {connectName(brand)}</h1>
        <p style={{ color: '#64748b', fontSize: '.9rem', lineHeight: 1.8, margin: '6px 0 18px' }}>
          سجّل الدخول هنا في المتصفح، ثم يُفتح التطبيق تلقائياً وأنت مسجّل.
        </p>

        {link ? (
          <>
            <p style={{ color: '#166534', fontWeight: 700, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
              <CheckCircle2 size={18} /> تم تسجيل الدخول
            </p>
            <a href={link} style={{ ...btn, marginTop: 14, background: '#047857', color: '#fff' }}>
              <Smartphone size={18} /> العودة إلى التطبيق
            </a>
          </>
        ) : busy || me === undefined ? (
          <p style={{ color: '#64748b', display: 'flex', gap: 8, justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /> لحظة…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {me ? (
              <>
                <button type="button" style={{ ...btn, background: '#047857', color: '#fff' }} onClick={() => void handoff(platform)}>
                  <UserRound size={18} /> المتابعة باسم {me.name}
                </button>
                <p style={{ color: '#94a3b8', fontSize: '.8rem', margin: '4px 0' }}>أو بحساب آخر:</p>
              </>
            ) : null}
            <GoogleContinueButton onToken={(t) => void onToken(t)} />
            <button type="button" style={{ ...btn, background: '#f1f5f9', color: '#334155' }} onClick={() => setPasswordLogin(true)}>
              <KeyRound size={18} /> كلمة المرور ومفتاح الأمان (الفريق والإدارة)
            </button>
          </div>
        )}

        {error ? <p style={{ marginTop: 12, color: '#b91c1c', fontSize: '.86rem' }}>{error}</p> : null}
        {info ? <p style={{ marginTop: 12, color: '#92400e', fontSize: '.86rem' }}>{info}</p> : null}
      </div>

      {passwordLogin ? (
        <LoginModal onClose={() => setPasswordLogin(false)} redirectTo={`/app-signin?platform=${platform}&auto=1`} />
      ) : null}
    </main>
  );
}
