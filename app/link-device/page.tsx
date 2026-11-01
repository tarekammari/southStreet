'use client';

/**
 * Phone side of the QR sign-in: scan the QR shown on a new device, pick the
 * number it shows, and the device opens this account. The Super Admin's phone
 * instead chooses who the device signs in as (Super Admin, accountant, guide or
 * pilgrim) and confirms with a security-key tap. Server side: /api/auth/qr-login/*.
 *
 * The QR carries its secret after "#", so it never reaches server logs or
 * referrers; the page reads it and removes it from the address bar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  Camera,
  CheckCircle2,
  Crown,
  KeyRound,
  Loader2,
  Monitor,
  Search,
  ShieldCheck,
  ShieldX,
  Smartphone,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import './link-device.css';

const LoginModal = dynamic(() => import('@/components/LoginModal'), { ssr: false });

type RoleId = 'SUPER_ADMIN' | 'ACCOUNTANT' | 'GUIDE_MURSHID' | 'PILGRIM_USER';

const ROLES: { id: RoleId; label: string; hint: string; Icon: typeof Crown }[] = [
  { id: 'SUPER_ADMIN', label: 'المشرف العام', hint: 'حسابك أنت', Icon: Crown },
  { id: 'ACCOUNTANT', label: 'محاسب', hint: 'لوحة المحاسبة', Icon: Calculator },
  { id: 'GUIDE_MURSHID', label: 'مرشد', hint: 'لوحة المرشد', Icon: BookOpen },
  { id: 'PILGRIM_USER', label: 'معتمر', hint: 'حساب معتمر / حاج', Icon: UserRound },
];

type Scan = {
  id: string;
  expiresAt: number;
  choices: number[];
  device: { label: string; ip: string; userAgent: string; requestedAt: number; sameNetwork: boolean };
  me: { id: string; name: string };
  mode: Mode;
  /** The Super Admin confirms with a security-key tap (not an owner who signs in with Google). */
  keyTap: boolean;
  counts: Record<RoleId, number> | null;
};

/** "choose": the Super Admin picks the account; "self": the phone opens its own account. */
type Mode = 'choose' | 'self';

type Account = { id: string; name: string; username: string; photo: string; phone: string };

type View =
  | { kind: 'checking' }
  | { kind: 'signin' }
  | { kind: 'scan' }
  | { kind: 'opening' }
  | { kind: 'review'; scan: Scan }
  | { kind: 'done'; name: string; role: string }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

const PENDING_KEY = 'ss_link_device_code';

/** Accepts the full link (…/link-device#c=…), a bare secret or a short code. Refuses links to other sites. */
function codeFrom(raw: string): string | null {
  const text = raw.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.host !== window.location.host || url.pathname !== '/link-device') return null;
      return new URLSearchParams(url.hash.slice(1)).get('c');
    } catch {
      return null;
    }
  }
  return text || null;
}

export default function LinkDevicePage() {
  const agency = useAgencyInfo();
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [me, setMe] = useState<{ name: string; mode: Mode; keyTap: boolean } | null>(null);

  const open = useCallback(async (code: string) => {
    setView({ kind: 'opening' });
    try {
      const res = await fetch('/api/auth/qr-login/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        sessionStorage.setItem(PENDING_KEY, code);
        setView({ kind: 'signin' });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'تعذّر قراءة الرمز.');
      setView({ kind: 'review', scan: data });
    } catch (err) {
      setView({ kind: 'error', message: (err as Error).message || 'تعذّر الاتصال بالخادم.' });
    }
  }, []);

  const onScan = useCallback((code: string) => void open(code), [open]);
  const home = me?.mode === 'choose' ? '/admin' : me ? '/portal' : '/';

  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('c');
    if (fromHash) {
      window.history.replaceState(null, '', '/link-device');
      sessionStorage.setItem(PENDING_KEY, fromHash);
    }
    fetch('/api/auth/qr-login/scan', { cache: 'no-store' })
      .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }))
      .catch(() => ({ status: 0, data: {} as any }))
      .then(({ status, data }) => {
        if (status === 403) {
          setView({ kind: 'error', message: data.error || 'لا يمكن ربط جهاز بهذا الحساب.' });
          return;
        }
        if (!data.me) {
          setView({ kind: 'signin' });
          return;
        }
        setMe({ name: data.me.name, mode: data.mode === 'choose' ? 'choose' : 'self', keyTap: Boolean(data.keyTap) });
        const pending = sessionStorage.getItem(PENDING_KEY);
        sessionStorage.removeItem(PENDING_KEY);
        if (pending) void open(pending);
        else setView({ kind: 'scan' });
      });
  }, [open]);

  return (
    <main className="lnk" dir="rtl">
      <div className="lnk-shell">
        <header className="lnk-head">
          <Link href={home} className="lnk-back" aria-label="رجوع"><ArrowRight className="w-5 h-5" /></Link>
          <div>
            <h1>ربط جهاز</h1>
            <p>{agency?.agency_name || ''}{me ? ` · ${me.name}` : ''}</p>
          </div>
          <span className="lnk-badge"><ShieldCheck className="w-4 h-4" /> {me?.keyTap ? 'محمي بمفتاح الأمان' : 'دخول آمن'}</span>
        </header>

        {view.kind === 'checking' || view.kind === 'opening' ? (
          <div className="lnk-state"><Loader2 className="w-7 h-7 animate-spin" /><p>{view.kind === 'opening' ? 'جاري قراءة الرمز…' : 'جاري التحقق من الجلسة…'}</p></div>
        ) : view.kind === 'signin' ? (
          <SignInFirst />
        ) : view.kind === 'scan' ? (
          <Scanner onCode={onScan} />
        ) : view.kind === 'review' ? (
          <Review
            scan={view.scan}
            onDone={(name, role) => setView({ kind: 'done', name, role })}
            onDenied={() => setView({ kind: 'denied' })}
            onError={(message) => setView({ kind: 'error', message })}
          />
        ) : view.kind === 'done' ? (
          <div className="lnk-state is-ok">
            <span className="lnk-state-icon"><CheckCircle2 className="w-9 h-9" /></span>
            <h2>تم فتح الجلسة على الجهاز</h2>
            <p>{me?.mode === 'choose' ? `${ROLES.find((r) => r.id === view.role)?.label || ''}: ` : ''}<b>{view.name}</b></p>
            <p className="lnk-muted">سُجّلت العملية في سجل التدقيق. إن لم تكن أنت من طلب الدخول فغيّر كلمة المرور فوراً.</p>
            <div className="lnk-row">
              <button type="button" className="lnk-btn is-ghost" onClick={() => setView({ kind: 'scan' })}>ربط جهاز آخر</button>
              <Link href={home} className="lnk-btn">{me?.mode === 'choose' ? 'لوحة الإدارة' : 'حسابي'}</Link>
            </div>
          </div>
        ) : view.kind === 'denied' ? (
          <div className="lnk-state is-bad">
            <span className="lnk-state-icon"><ShieldX className="w-9 h-9" /></span>
            <h2>رُفض الطلب</h2>
            <p>لم يُفتح أي حساب على ذلك الجهاز.</p>
            <button type="button" className="lnk-btn" onClick={() => setView({ kind: 'scan' })}>مسح رمز آخر</button>
          </div>
        ) : (
          <div className="lnk-state is-bad">
            <span className="lnk-state-icon"><AlertTriangle className="w-9 h-9" /></span>
            <h2>تعذّر إكمال الربط</h2>
            <p>{view.message}</p>
            <button type="button" className="lnk-btn" onClick={() => setView({ kind: 'scan' })}>مسح الرمز من جديد</button>
          </div>
        )}
      </div>
    </main>
  );
}

function SignInFirst() {
  const [login, setLogin] = useState(false);
  return (
    <div className="lnk-state">
      <span className="lnk-state-icon is-key"><KeyRound className="w-8 h-8" /></span>
      <h2>سجّل الدخول على هذا الهاتف أولاً</h2>
      <p>هاتفك هو مفتاح الدخول: سجّل الدخول بحسابك هنا، ثم امسح الرمز الظاهر على الجهاز الآخر. المشرف العام يستطيع اختيار الحساب الذي يُفتح.</p>
      <button type="button" className="lnk-btn" onClick={() => setLogin(true)}>تسجيل الدخول</button>
      {login ? <LoginModal onClose={() => setLogin(false)} redirectTo="/link-device" /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Camera scanner (with a typed short code as fallback)
 * ------------------------------------------------------------------ */

function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'starting' | 'on' | 'unsupported' | 'blocked'>('starting');
  const [manual, setManual] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let frame = 0;
    const Detector = (window as any).BarcodeDetector;
    (async () => {
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        setCamera('unsupported');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCamera('on');
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            const raw = found?.[0]?.rawValue;
            if (raw) {
              const code = codeFrom(raw);
              if (code) {
                stopped = true;
                navigator.vibrate?.(40);
                onCode(code);
                return;
              }
              setWarning('هذا الرمز ليس رمز دخول من هذا الموقع. لا تمسح رموزاً من مصادر أخرى.');
            }
          } catch {
            /* next frame */
          }
          frame = window.setTimeout(tick, 180);
        };
        void tick();
      } catch {
        setCamera('blocked');
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeFrom(manual);
    if (code) onCode(code);
  };

  return (
    <section className="lnk-scan">
      <div className={`lnk-viewfinder is-${camera}`}>
        <video ref={videoRef} muted playsInline aria-label="الكاميرا" />
        <span className="lnk-reticle" aria-hidden><i /><i /><i /><i /></span>
        {camera === 'on' ? <span className="lnk-laser" aria-hidden /> : null}
        {camera !== 'on' ? (
          <span className="lnk-viewfinder-note">
            {camera === 'starting' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-7 h-7" />}
            {camera === 'starting'
              ? 'جاري فتح الكاميرا…'
              : camera === 'blocked'
                ? 'لم يُسمح باستعمال الكاميرا. اسمح بها من إعدادات المتصفح، أو أدخل الرمز أدناه.'
                : 'هذا المتصفح لا يقرأ الرموز مباشرة. امسح الرمز بتطبيق كاميرا الهاتف، أو أدخل الرمز أدناه.'}
          </span>
        ) : null}
      </div>
      <p className="lnk-hint">وجّه الكاميرا نحو رمز QR الظاهر على الجهاز الجديد</p>
      {warning ? <p className="lnk-alert" role="alert"><AlertTriangle className="w-4 h-4" /> {warning}</p> : null}

      <form className="lnk-manual" onSubmit={submitManual}>
        <label htmlFor="lnk-code">أو أدخل الرمز المكتوب تحت الـ QR</label>
        <div>
          <input
            id="lnk-code"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
          />
          <button type="submit" className="lnk-btn" disabled={manual.replace(/[^A-Z0-9]/gi, '').length !== 8}>متابعة</button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Review: device, matching number, role and account
 * ------------------------------------------------------------------ */

function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

function Review({
  scan,
  onDone,
  onDenied,
  onError,
}: {
  scan: Scan;
  onDone: (name: string, role: RoleId) => void;
  onDenied: () => void;
  onError: (message: string) => void;
}) {
  const left = useCountdown(scan.expiresAt);
  const [number, setNumber] = useState<number | null>(null);
  const [role, setRole] = useState<RoleId | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<{ total: number; accounts: Account[] } | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState<'' | 'approve' | 'deny'>('');
  const [error, setError] = useState('');

  const mobile = /android|iphone|ipad|mobile/i.test(scan.device.userAgent);
  const DeviceIcon = mobile ? Smartphone : Monitor;

  useEffect(() => {
    if (!role || role === 'SUPER_ADMIN') return;
    let alive = true;
    setLoadingList(true);
    const t = window.setTimeout(() => {
      fetch(`/api/auth/qr-login/accounts?role=${role}&q=${encodeURIComponent(query)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (!alive) return;
          setList(data);
          // One account of that kind: nothing to choose.
          if (!query && data.total === 1) setAccount(data.accounts[0]);
        })
        .catch(() => alive && setList({ total: 0, accounts: [] }))
        .finally(() => alive && setLoadingList(false));
    }, query ? 250 : 0);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [role, query]);

  const choose = scan.mode === 'choose';
  const ready = number !== null && left > 0 && (!choose || (role !== null && (role === 'SUPER_ADMIN' || account !== null)));
  const target = !choose || role === 'SUPER_ADMIN' ? scan.me.name : account?.name;

  const answer = async (decision: 'approve' | 'deny') => {
    setBusy(decision);
    setError('');
    try {
      const res = await adminFetch('/api/auth/qr-login/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scan.id, decision, number, role, userId: account?.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (decision === 'deny') {
        onDenied();
        return;
      }
      if (res.ok) {
        navigator.vibrate?.([30, 60, 30]);
        onDone(data.account?.name || target || '', data.account?.role || role || '');
        return;
      }
      if (data.code === 'WRONG_NUMBER' || data.code === 'EXPIRED' || res.status === 404) {
        onError(data.error || 'انتهى الطلب.');
        return;
      }
      setError(data.error || 'تعذّر التأكيد.');
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const roleCards = useMemo(
    () =>
      ROLES.map((r) => ({
        ...r,
        count: scan.counts?.[r.id] ?? 0,
        disabled: r.id !== 'SUPER_ADMIN' && !((scan.counts?.[r.id] ?? 0) > 0),
      })),
    [scan.counts]
  );

  if (left === 0) {
    return (
      <div className="lnk-state is-bad">
        <span className="lnk-state-icon"><AlertTriangle className="w-9 h-9" /></span>
        <h2>انتهت مهلة الطلب</h2>
        <p>حدّث الرمز على الجهاز ثم امسحه من جديد.</p>
      </div>
    );
  }

  return (
    <section className="lnk-review">
      <div className="lnk-device">
        <span className="lnk-device-icon"><DeviceIcon className="w-6 h-6" /></span>
        <div className="lnk-device-copy">
          <strong>طلب دخول من {scan.device.label}</strong>
          <span dir="ltr">{scan.device.ip}</span>
          <span>
            {new Date(scan.device.requestedAt).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <span className={`lnk-net${scan.device.sameNetwork ? ' is-same' : ''}`}>
          {scan.device.sameNetwork ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {scan.device.sameNetwork ? 'نفس شبكتك' : 'شبكة أخرى'}
        </span>
        <span className="lnk-timer" dir="ltr">{left}s</span>
      </div>

      {!scan.device.sameNetwork ? (
        <p className="lnk-alert">
          <AlertTriangle className="w-4 h-4" />
          الجهاز على شبكة مختلفة عن هاتفك. وافق فقط إن كان الجهاز أمامك الآن ولم يرسل لك أحد هذا الرمز.
        </p>
      ) : null}

      <div className="lnk-step">
        <h2><span>1</span> اختر الرقم الظاهر على شاشة الجهاز</h2>
        <div className="lnk-numbers" role="radiogroup" aria-label="رقم المطابقة">
          {scan.choices.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={number === n}
              className={number === n ? 'is-on' : ''}
              onClick={() => setNumber(n)}
              dir="ltr"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {choose ? (
      <div className="lnk-step">
        <h2><span>2</span> افتح الجهاز بصفة</h2>
        <div className="lnk-roles" role="radiogroup" aria-label="الدور">
          {roleCards.map(({ id, label, hint, Icon, count, disabled }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={role === id}
              disabled={disabled}
              className={`lnk-role${role === id ? ' is-on' : ''}${id === 'SUPER_ADMIN' ? ' is-super' : ''}`}
              onClick={() => {
                setRole(id);
                setAccount(null);
                setQuery('');
                setList(null);
              }}
            >
              <Icon className="w-6 h-6" />
              <strong>{label}</strong>
              <em>{id === 'SUPER_ADMIN' ? hint : disabled ? 'لا توجد حسابات' : `${count} حساب`}</em>
            </button>
          ))}
        </div>
      </div>
      ) : null}

      {choose && role && role !== 'SUPER_ADMIN' ? (
        <div className="lnk-step">
          <h2><span>3</span> اختر الحساب</h2>
          <label className="lnk-search">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الهاتف أو اسم المستخدم" />
            {loadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          </label>
          <ul className="lnk-accounts" role="radiogroup" aria-label="الحساب">
            {(list?.accounts || []).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={account?.id === a.id}
                  className={account?.id === a.id ? 'is-on' : ''}
                  onClick={() => setAccount(a)}
                >
                  <span className="lnk-avatar">
                    {a.photo ? <img src={a.photo} alt="" /> : a.name.charAt(0)}
                  </span>
                  <span className="lnk-account-copy">
                    <strong>{a.name}</strong>
                    <em dir="ltr">{a.username || a.phone}</em>
                  </span>
                </button>
              </li>
            ))}
            {list && !list.accounts.length ? <li className="lnk-empty">لا يوجد حساب بهذا الاسم.</li> : null}
          </ul>
          {list && list.total > list.accounts.length && !query ? (
            <p className="lnk-muted">تظهر أول {list.accounts.length} من {list.total}. ابحث للوصول إلى البقية.</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="lnk-alert" role="alert"><AlertTriangle className="w-4 h-4" /> {error}</p> : null}

      <div className="lnk-actions">
        <button type="button" className="lnk-btn is-primary" disabled={!ready || Boolean(busy)} onClick={() => void answer('approve')}>
          {busy === 'approve' ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
          {!ready ? (choose ? 'أكمل الخطوات للمتابعة' : 'اختر الرقم للمتابعة') : choose ? `افتح الجهاز${target ? ` — ${target}` : ''}` : 'ادخل بحسابي على هذا الجهاز'}
        </button>
        <button type="button" className="lnk-btn is-danger" disabled={Boolean(busy)} onClick={() => void answer('deny')}>
          {busy === 'deny' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />} ليس أنا — رفض
        </button>
        <p className="lnk-muted">{choose ? (scan.keyTap ? 'سيطلب منك المتصفح لمس مفتاح الأمان لتأكيد الدخول.' : 'وافق فقط إن كان الجهاز أمامك الآن.') : 'سيدخل الجهاز إلى حسابك أنت. لا توافق إن لم يكن الجهاز أمامك.'}</p>
      </div>
    </section>
  );
}
