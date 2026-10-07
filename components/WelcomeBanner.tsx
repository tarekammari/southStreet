'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { readStoredUser } from '@/lib/client-session';

const PENDING_KEY = 'ss_welcome_pending';
const SEEN_KEY = 'ss_welcome_seen';

export function markWelcomePending() {
  if (typeof window === 'undefined') return;
  try {
    if (!localStorage.getItem(SEEN_KEY)) {
      localStorage.setItem(PENDING_KEY, '1');
    }
  } catch {
    /* ignore */
  }
}

export default function WelcomeBanner() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_KEY) === '1';
      const seen = localStorage.getItem(SEEN_KEY) === '1';
      const user = readStoredUser();
      if (pending && !seen && user) {
        setName(String(user.name || ''));
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="welcome-banner" dir="rtl" role="status">
      <Sparkles className="w-5 h-5 welcome-banner-icon" aria-hidden />
      <div className="welcome-banner-copy">
        <strong>أهلاً بك{name ? `، ${name}` : ''}!</strong>
        <p>حسابك جاهز. تصفّح البرامج، احفظ المفضلة، وأرسل طلب عمرتك — الوكالة تؤكد الحجز.</p>
        <div className="welcome-banner-actions">
          <Link href="/packages" className="book-btn book-btn-primary no-underline" onClick={dismiss}>
            استكشف البرامج
          </Link>
          <Link href="/book" className="book-btn book-btn-ghost no-underline" onClick={dismiss}>
            ابدأ الحجز
          </Link>
        </div>
      </div>
      <button type="button" className="welcome-banner-close" onClick={dismiss} aria-label="إغلاق">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
