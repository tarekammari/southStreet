'use client';

import { useEffect, useRef, useState } from 'react';
import { PUBLIC_GOOGLE_WEB_CLIENT_ID } from '@/lib/google-web-client';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46c-.28 1.5-1.12 2.77-2.39 3.63v3.02h3.87c2.26-2.08 3.55-5.14 3.55-8.68z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3.02c-1.08.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.27v3.12C3.25 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.25 14.26A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.55.38-2.26V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l3.98-3.12z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.62l3.98 3.12C6.2 6.87 8.86 4.75 12 4.75z" />
    </svg>
  );
}

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: (callback?: (notification: unknown) => void) => void;
        };
        oauth2?: {
          initTokenClient: (opts: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

function envClientId(): string {
  return String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
}

function waitForGis(timeoutMs = 10000): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (!document.getElementById('google-gis')) {
      const script = document.createElement('script');
      script.id = 'google-gis';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onerror = () => reject(new Error('تعذر تحميل خدمة جوجل'));
      document.head.appendChild(script);
    }

    const started = Date.now();
    const tick = () => {
      if (window.google?.accounts) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('تعذر تحميل خدمة جوجل'));
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

export default function GoogleContinueButton({
  label = 'المتابعة باستخدام Google',
  onToken,
  disabled,
}: {
  label?: string;
  onToken: (idToken: string) => void;
  disabled?: boolean;
}) {
  const tokenClientRef = useRef<TokenClient | null>(null);
  const [clientId, setClientId] = useState(envClientId);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState('');
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const id = String(d.googleClientId || envClientId() || '').trim();
        setClientId(id);
        if (!id) setHint('تسجيل جوجل غير مُعد على الخادم');
      })
      .catch(() => {
        if (cancelled) return;
        if (!envClientId()) setHint('تعذر تحميل إعداد جوجل');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    setHint('');
    setReady(false);
    tokenClientRef.current = null;

    const setup = async () => {
      await waitForGis();
      if (cancelled || !window.google?.accounts) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: { credential?: string }) => {
          if (resp.credential) onTokenRef.current(resp.credential);
        },
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (window.google.accounts.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (resp) => {
            if (resp.access_token) {
              setHint('');
              onTokenRef.current(resp.access_token);
              return;
            }
            if (resp.error && resp.error !== 'popup_closed_by_user') {
              setHint('تعذر فتح نافذة جوجل. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
            }
          },
          error_callback: () => {
            window.google?.accounts?.id?.prompt((notification) => {
              const n = notification as { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean };
              if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) {
                setHint('تعذر فتح نافذة جوجل. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
              }
            });
          },
        });
      }

      if (!cancelled) setReady(true);
    };

    setup().catch((err: Error) => {
      if (!cancelled) setHint(err.message || 'تعذر تحميل خدمة جوجل');
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const start = () => {
    if (disabled) return;
    if (!clientId) {
      setHint('تسجيل جوجل غير مُعد على الخادم');
      return;
    }
    if (tokenClientRef.current) {
      setHint('');
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
      return;
    }
    if (!window.google?.accounts) {
      setHint('جاري تجهيز جوجل…');
      return;
    }
    window.google.accounts.id.prompt();
  };

  return (
    <div className="google-continue">
      <button
        type="button"
        className="google-continue-btn"
        onClick={start}
        disabled={disabled}
        aria-busy={!ready && !hint}
      >
        <GoogleMark />
        {ready || hint || !clientId ? label : 'جاري تجهيز جوجل…'}
      </button>
      {hint ? <p className="google-continue-hint">{hint}</p> : null}
    </div>
  );
}
