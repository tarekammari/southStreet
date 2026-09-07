'use client';

import { useEffect, useRef, useState } from 'react';

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

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: (callback?: (notification: unknown) => void) => void;
        };
      };
    };
  }
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
  const hostRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState('');
  const [ready, setReady] = useState(false);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => setClientId(d.googleClientId || ''))
      .catch(() => setClientId(''));
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const paint = () => {
      if (!window.google?.accounts?.id || !hostRef.current) return false;
      hostRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: { credential?: string }) => {
          if (resp.credential) onTokenRef.current(resp.credential);
        },
        ux_mode: 'popup',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(hostRef.current, {
        theme: 'outline',
        size: 'large',
        width: 336,
        text: 'continue_with',
        locale: 'ar',
      });
      setReady(true);
      return true;
    };

    let tries = 0;
    const wait = () => {
      if (paint()) return;
      if (tries++ > 25) return;
      window.setTimeout(wait, 80);
    };

    if (window.google?.accounts?.id) {
      wait();
      return;
    }
    if (document.getElementById('google-gis')) {
      const t = window.setInterval(() => {
        if (window.google?.accounts?.id) {
          window.clearInterval(t);
          wait();
        }
      }, 200);
      return () => window.clearInterval(t);
    }
    const script = document.createElement('script');
    script.id = 'google-gis';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = wait;
    document.head.appendChild(script);
  }, [clientId]);

  const start = () => {
    const nativeBtn = hostRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
    if (nativeBtn) {
      nativeBtn.click();
      return;
    }
    window.google?.accounts?.id?.prompt();
  };

  return (
    <div className="google-continue">
      <div className="google-continue-host" ref={hostRef} aria-hidden />
      <button type="button" className="google-continue-btn" onClick={start} disabled={disabled || !ready}>
        <GoogleMark />
        {label}
      </button>
    </div>
  );
}
