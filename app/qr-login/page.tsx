'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Globe2, Laptop, Loader2, MapPin, QrCode, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { openLogin } from '@/components/auth/openLogin';
import { getAuthToken } from '@/lib/api-client';

type Device = { browser: string; os: string; ip: string };
type View =
  | { kind: 'loading' }
  | { kind: 'signin' }
  | { kind: 'ask'; device: Device; choices: number[]; createdAt: number; name: string }
  | { kind: 'busy' }
  | { kind: 'done'; ok: boolean; message: string }
  | { kind: 'error'; message: string };

/** A link from the computer's QR: /qr-login?r=<id>. */
function requestIdFrom(text: string): string {
  try {
    const u = new URL(text, window.location.origin);
    if (u.pathname === '/qr-login') return u.searchParams.get('r') || '';
  } catch {
    /* not a link */
  }
  return '';
}

/** Camera scanner for when the page is opened from the menu («ربط جهاز كمبيوتر»). */
function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState('وجّه الكاميرا نحو رمز QR الظاهر على شاشة الكمبيوتر');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    const Detector = (window as any).BarcodeDetector;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        if (!Detector) {
          setHint('هذا المتصفح لا يقرأ الرموز مباشرة — امسح الرمز بتطبيق الكاميرا في هاتفك');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            const id = codes?.[0]?.rawValue ? requestIdFrom(codes[0].rawValue) : '';
            if (id) {
              window.location.replace(`/qr-login?r=${encodeURIComponent(id)}`);
              return;
            }
            if (codes?.[0]?.rawValue) setHint('هذا ليس رمز الدخول — امسح الرمز الظاهر في نافذة «الدخول بالهاتف» على الكمبيوتر');
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        setHint('تعذّر فتح الكاميرا — اسمح للموقع باستعمال الكاميرا، أو امسح الرمز بتطبيق الكاميرا في هاتفك');
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <section className="qrl-card">
      <span className="qrl-ico"><QrCode aria-hidden /></span>
      <h1>ربط جهاز كمبيوتر</h1>
      <p>على الكمبيوتر: افتح «تسجيل الدخول» ثم «الدخول بالهاتف»، وامسح الرمز هنا.</p>
      <div className="qrl-camera">
        <video ref={video} muted playsInline />
        <span className="qrl-frame" aria-hidden />
      </div>
      <small className="qrl-hint">{hint}</small>
    </section>
  );
}

function Approve({ id }: { id: string }) {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const scan = useCallback(async () => {
    if (!getAuthToken()) return setView({ kind: 'signin' });
    try {
      const res = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) return setView({ kind: 'signin' });
      if (!res.ok) return setView({ kind: 'error', message: d.error || 'تعذّر قراءة الطلب' });
      setView({ kind: 'ask', device: d.device, choices: d.choices, createdAt: d.createdAt, name: d.name });
    } catch {
      setView({ kind: 'error', message: 'تعذّر الاتصال — تحقق من الإنترنت' });
    }
  }, [id]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const answer = async (pick: number | null) => {
    setView({ kind: 'busy' });
    try {
      const res = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pick === null ? { action: 'deny', id } : { action: 'approve', id, pick }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setView({ kind: 'error', message: d.error || 'تعذّر الإرسال' });
      setView({ kind: 'done', ok: d.status === 'APPROVED', message: d.message });
    } catch {
      setView({ kind: 'error', message: 'تعذّر الاتصال — تحقق من الإنترنت' });
    }
  };

  if (view.kind === 'loading' || view.kind === 'busy') {
    return <section className="qrl-card is-center"><Loader2 className="animate-spin qrl-spin" aria-hidden /><p>{view.kind === 'busy' ? 'جاري الإرسال…' : 'جاري قراءة الطلب…'}</p></section>;
  }
  if (view.kind === 'signin') {
    return (
      <section className="qrl-card is-center">
        <span className="qrl-ico"><ShieldCheck aria-hidden /></span>
        <h1>سجّل الدخول على هاتفك أولاً</h1>
        <p>يجب أن يكون حسابك مفتوحاً على هذا الهاتف لتأكيد الدخول على الكمبيوتر.</p>
        <button
          type="button"
          className="qrl-primary"
          onClick={() => {
            const back = `/qr-login?r=${encodeURIComponent(id)}`;
            if (!openLogin({ method: 'choose', redirectTo: back })) window.location.href = '/app?login=1';
          }}
        >
          تسجيل الدخول
        </button>
        <small className="qrl-hint">بعد الدخول نعود إلى هذا الطلب تلقائياً، إن لم تنتهِ صلاحيته (دقيقتان).</small>
      </section>
    );
  }
  if (view.kind === 'error') {
    return (
      <section className="qrl-card is-center">
        <span className="qrl-ico is-bad"><ShieldAlert aria-hidden /></span>
        <h1>تعذّر إكمال الطلب</h1>
        <p>{view.message}</p>
        <Link href="/qr-login" className="qrl-primary">مسح رمز جديد</Link>
      </section>
    );
  }
  if (view.kind === 'done') {
    return (
      <section className="qrl-card is-center">
        <span className={`qrl-ico ${view.ok ? 'is-ok' : 'is-bad'}`}>{view.ok ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}</span>
        <h1>{view.ok ? 'تم ربط الكمبيوتر' : 'أُلغي الطلب'}</h1>
        <p>{view.message}</p>
        {view.ok ? <small className="qrl-hint">يمكنك الخروج من الكمبيوتر في أي وقت من «حسابي» أو من زر الخروج عليه.</small> : null}
        <Link href="/" className="qrl-ghost">الصفحة الرئيسية</Link>
      </section>
    );
  }

  const when = new Date(view.createdAt).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
  return (
    <section className="qrl-card">
      <span className="qrl-ico"><Laptop aria-hidden /></span>
      <h1>دخول إلى حسابك من كمبيوتر</h1>
      <p>تأكد أن هذا الطلب منك قبل الموافقة. سيدخل الكمبيوتر إلى حساب <b>{view.name}</b>.</p>
      <ul className="qrl-device">
        <li><Globe2 aria-hidden /> {view.device.browser} · {view.device.os}</li>
        <li><MapPin aria-hidden /> <span dir="ltr">{view.device.ip}</span></li>
        <li><Clock aria-hidden /> طُلب الساعة {when}</li>
      </ul>
      <h2>اختر الرقم الظاهر على شاشة الكمبيوتر</h2>
      <div className="qrl-choices">
        {view.choices.map((n) => (
          <button key={n} type="button" onClick={() => void answer(n)}>{n}</button>
        ))}
      </div>
      <button type="button" className="qrl-deny" onClick={() => void answer(null)}>ليس أنا — إلغاء الطلب</button>
      <small className="qrl-hint">لا يرى أحد كلمة مرورك. اختيار رقم خاطئ يلغي الطلب للأمان.</small>
    </section>
  );
}

function Inner() {
  const id = useSearchParams().get('r') || '';
  return id ? <Approve id={id} /> : <Scanner />;
}

export default function QrLoginPage() {
  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <main className="qrl" dir="rtl">
        <Suspense fallback={<section className="qrl-card is-center"><Loader2 className="animate-spin qrl-spin" aria-hidden /></section>}>
          <Inner />
        </Suspense>
      </main>
    </div>
  );
}
