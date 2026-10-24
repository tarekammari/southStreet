'use client';

/**
 * Download page of South Street Connect (/app): the native apps for Android and
 * Windows (real call screen, ringtone, works while closed), the web app for
 * iPhone, how to install each, and a QR code for computer visitors.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';
import QrLinkSignIn from '@/components/auth/QrLinkSignIn';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BatteryCharging,
  Bell,
  BellRing,
  ChevronDown,
  Download,
  Lock,
  MessageCircle,
  Mic,
  Monitor,
  Phone,
  PhoneCall,
  PhoneOff,
  Share,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  Users,
  Zap,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CONNECT_VERSION, NATIVE_RELEASES } from '@/lib/connect/version';
import { authHeaders } from '@/lib/api-client';
import { checkAppUpdate, insideNativeApp, nativeVersion, type UpdateCheck } from '@/lib/connect/native-bridge';

const LoginModal = dynamic(() => import('@/components/LoginModal'), { ssr: false });
import { CONNECT_INSTALL_EVENT, connectInstallHref } from '@/components/connect/installConnect';
import '@/app/app-page.css';

type Platform = 'android' | 'windows' | 'ios';

const PLATFORMS: Record<
  Platform,
  { label: string; icon: typeof Smartphone; href?: string; cta: string; size?: string; steps: string[]; note?: string }
> = {
  android: {
    label: 'أندرويد',
    icon: Smartphone,
    href: NATIVE_RELEASES.android.url,
    cta: 'تحميل لأندرويد',
    size: 'APK · 4 ميغابايت',
    steps: [
      'سجّل الدخول بحسابك ثم اضغط «تحميل لأندرويد» وافتح الملف واضغط «تثبيت».',
      'افتح SS Connect وسجّل الدخول.',
      'اضغط «موافق» مرة واحدة — يكمل التطبيق الإعداد بنفسه.',
    ],
  },
  windows: {
    label: 'ويندوز',
    icon: Monitor,
    href: NATIVE_RELEASES.windows.url,
    cta: 'تحميل لويندوز',
    size: 'Windows 10 / 11 · 80 ميغابايت',
    steps: [
      'سجّل الدخول بحسابك ثم اضغط «تحميل لويندوز» وشغّل الملف.',
      'إن ظهرت «Windows protected your PC»: اضغط «More info» ثم «Run anyway».',
      'سجّل الدخول. يعمل Connect مع تشغيل ويندوز ويبقى بجانب الساعة.',
    ],
    note: 'المكالمة تظهر في نافذة وسط الشاشة فوق كل البرامج، مع الرنين.',
  },
  ios: {
    label: 'آيفون',
    icon: Smartphone,
    cta: 'فتح Connect',
    steps: [
      'افتح هذه الصفحة في Safari على الآيفون.',
      'اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».',
      'افتح Connect من الشاشة الرئيسية وفعّل الإشعارات (iOS 16.4 أو أحدث).',
    ],
    note: 'تطبيق الآيفون الكامل قادم قريباً.',
  },
};

const FEATURES = [
  { icon: PhoneCall, title: 'مكالمات مثل الهاتف', text: 'شاشة مكالمة كاملة ورنين حقيقي، حتى والتطبيق مغلق والهاتف مقفل.' },
  { icon: MessageCircle, title: 'رسائل فورية', text: 'تصل في أقل من ثانية إلى فريق الوكالة ومرشدك.' },
  { icon: Mic, title: 'رسائل صوتية', text: 'سجّل بضغطة وأرسل — مثالية في الحرم وأثناء التنقل.' },
  { icon: Zap, title: 'صوت واضح', text: 'إلغاء الصدى والضجيج، ويتحمّل شبكات الجيل الرابع الضعيفة.' },
  { icon: Bell, title: 'لا يفوتك شيء', text: 'إشعارات للرسائل والمكالمات الفائتة على كل أجهزتك.' },
  { icon: Users, title: 'رفاق رحلتك', text: 'أضف من تعرفهم، وبعد قبولهم تتراسلون وتتصلون مجاناً — مع اقتراحات ذكية من نفس رحلتك.' },
  { icon: Lock, title: 'خاص وآمن', text: 'بحسابك في ساوث ستريت فقط. لا أحد يراسلك أو يتصل بك قبل أن تقبل طلبه، ولا تظهر أرقامكم لبعض.' },
];

const HOW = [
  { icon: BellRing, title: 'يتصل فريق الوكالة', text: 'من لوحة الإدارة أو تطبيق المرشد.' },
  { icon: Smartphone, title: 'يرنّ جهازك', text: 'شاشة مكالمة كاملة ورنين يعلو تدريجياً.' },
  { icon: Phone, title: 'ترد بلمسة', text: 'صوت مباشر وواضح، والمكالمة تبقى والشاشة مطفأة.' },
];

const FAQ = [
  {
    q: 'ويندوز يقول «Windows protected your PC» — هل هذا آمن؟',
    a: 'نعم. تظهر هذه الرسالة لكل برنامج جديد غير موقّع بشهادة مدفوعة. اضغط «More info» ثم «Run anyway» مرة واحدة فقط.',
  },
  {
    q: 'أندرويد يطلب السماح بالتثبيت من مصدر غير معروف',
    a: 'التطبيق يُحمَّل من موقعنا مباشرة وليس من المتجر، لذلك يطلب أندرويد إذنك مرة واحدة. اسمح لـ Chrome بالتثبيت ثم أكمل.',
  },
  {
    q: 'ما الذي يطلبه التطبيق عند أول تشغيل؟',
    a: 'بطاقة واحدة: اضغط «موافق» ثم «سماح» في كل نافذة — الإشعارات والميكروفون والعمل في الخلفية وشاشة المكالمة — ليرنّ الهاتف حتى والتطبيق مغلق. استهلاكه للبطارية ضئيل جداً.',
  },
  {
    q: 'كيف أتواصل مع معتمر آخر؟',
    a: 'من «جهات الاتصال» اضغط «إضافة شخص» وأدخل رقمه أو بريده، أو اختره من «قد تعرفهم». بعد قبوله طلبك يظهر في «المفضّلون» عندكما وتتراسلان وتتصلان.',
  },
  {
    q: 'كيف أسجّل الدخول بحساب جوجل؟',
    a: 'اضغط «المتابعة باستخدام Google»: يُفتح المتصفح لتسجيل الدخول ثم يعود التطبيق تلقائياً وأنت مسجّل.',
  },
];

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'windows';
}

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const } }),
};

/** Animated phone showing an incoming Connect call. */
function PhoneMock() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="cx-phone"
      aria-hidden
      initial={{ opacity: 0, y: 30, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="cx-phone-body"
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="cx-notch" />
        <div className="cx-screen">
          <span className="cx-screen-brand">South Street Connect</span>
          <div className="cx-caller">
            <span className="cx-avatar">
              <i />
              <i />
              <i />
              <b>م</b>
            </span>
            <strong>مرشد الرحلة</strong>
            <small>مكالمة صوتية واردة</small>
          </div>
          <div className="cx-screen-actions">
            <span className="cx-btn is-decline"><PhoneOff /></span>
            <span className="cx-btn is-accept"><Phone /></span>
          </div>
        </div>
      </motion.div>
      <motion.div
        className="cx-bubble is-a"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <MessageCircle /> وصلنا الفندق بسلام 🤍
      </motion.div>
      <motion.div
        className="cx-bubble is-b"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <Mic /> رسالة صوتية · 0:12
      </motion.div>
    </motion.div>
  );
}

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('android');
  const [detected, setDetected] = useState<Platform>('android');
  const [qr, setQr] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  // The apps are for account holders only: download after signing in.
  const [account, setAccount] = useState<'unknown' | 'in' | 'out'>('unknown');
  const [loginOpen, setLoginOpen] = useState(false);
  // Opened inside the installed app: never offer to install it again, only updates.
  const [inApp, setInApp] = useState(false);
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateCheck | null>(null);
  // Install asked for by Sakhr (/app?install=… or an event when already here).
  const [pendingInstall, setPendingInstall] = useState<Platform | 'auto' | null>(null);
  const [installNote, setInstallNote] = useState('');
  const [loginRedirect, setLoginRedirect] = useState('/app#install');

  useEffect(() => {
    setInApp(insideNativeApp());
    void fetch('/api/connect/config', { headers: authHeaders(), cache: 'no-store' })
      .then((r) => setAccount(r.ok ? 'in' : 'out'))
      .catch(() => setAccount('out'));
    if (new URLSearchParams(window.location.search).get('login') === '1') setLoginOpen(true);
  }, []);

  useEffect(() => {
    const toPlatform = (v: unknown): Platform | 'auto' =>
      v === 'android' || v === 'windows' ? v : v === 'iphone' || v === 'ios' ? 'ios' : 'auto';
    const params = new URLSearchParams(window.location.search);
    if (params.has('install')) {
      setPendingInstall(toPlatform(params.get('install')));
      // A refresh must not download again.
      params.delete('install');
      const rest = params.toString();
      window.history.replaceState(null, '', `/app${rest ? `?${rest}` : ''}#install`);
    }
    const onInstall = (e: Event) => setPendingInstall(toPlatform((e as CustomEvent).detail));
    window.addEventListener(CONNECT_INSTALL_EVENT, onInstall);
    return () => window.removeEventListener(CONNECT_INSTALL_EVENT, onInstall);
  }, []);

  // Runs once the sign-in state is known: download, iPhone steps, or sign in first.
  useEffect(() => {
    if (!pendingInstall || account === 'unknown') return;
    const p = pendingInstall === 'auto' ? detect() : pendingInstall;
    setPendingInstall(null);
    setPlatform(p);
    window.setTimeout(() => document.getElementById('install')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    const target = PLATFORMS[p];
    if (inApp) {
      setInstallNote('Connect مثبّت على هذا الجهاز بالفعل.');
      return;
    }
    if (!target.href) {
      setInstallNote('على الآيفون: افتح هذه الصفحة في Safari، ثم «مشاركة» ← «إضافة إلى الشاشة الرئيسية».');
      return;
    }
    if (account !== 'in') {
      setInstallNote('التطبيق لأصحاب الحسابات: سجّل الدخول أولاً، ثم يبدأ التنزيل تلقائياً.');
      setLoginRedirect(connectInstallHref(p === 'ios' ? 'iphone' : p));
      setLoginOpen(true);
      return;
    }
    const link = document.createElement('a');
    link.href = target.href;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setInstallNote(`بدأ تنزيل Connect ${target.label}. افتح الملف عند انتهائه لإكمال التثبيت.`);
  }, [pendingInstall, account, inApp]);

  const checkUpdates = async () => {
    setChecking(true);
    setUpdate(await checkAppUpdate(process.env.APP_VERSION || ''));
    setChecking(false);
  };

  useEffect(() => {
    const p = detect();
    setPlatform(p);
    setDetected(p);
    void QRCode.toDataURL(`${window.location.origin}/app?utm_source=qr`, { margin: 1, width: 360, color: { dark: '#064e3b', light: '#ffffff' } }).then(setQr);
  }, []);

  const main = PLATFORMS[detected];
  const current = PLATFORMS[platform];
  const others = (Object.keys(PLATFORMS) as Platform[]).filter((p) => p !== detected);

  const primary = (p: Platform, className: string) =>
    inApp ? (
      <button type="button" className={className} disabled={checking} onClick={() => void checkUpdates()}>
        <ShieldCheck />{' '}
        {checking
          ? 'جارٍ التحقق…'
          : update?.state === 'latest'
            ? `التطبيق مثبّت · أحدث إصدار ${nativeVersion() || ''}`
            : update?.state === 'ready'
              ? 'تحديث جاهز — وافق على التثبيت'
              : update?.state === 'error'
                ? 'تعذّر التحقق — أعد المحاولة'
                : 'التطبيق مثبّت · التحقق من التحديثات'}
      </button>
    ) : PLATFORMS[p].href && account !== 'in' ? (
      <button type="button" className={className} onClick={() => setLoginOpen(true)}>
        <Lock /> سجّل الدخول للتنزيل
      </button>
    ) : PLATFORMS[p].href ? (
      <a href={PLATFORMS[p].href} download className={className}>
        <Download /> {PLATFORMS[p].cta}
      </a>
    ) : (
      <Link href="/connect" className={className}>
        <Smartphone /> {PLATFORMS[p].cta}
      </Link>
    );

  return (
    <div className="page-shell min-h-screen cx-page">
      <Navbar variant="light" />
      <QrLinkSignIn />
      <main dir="rtl">
        {/* ---------- hero ---------- */}
        <section className="cx-hero">
          <div className="cx-blobs" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="cx-wrap cx-hero-grid">
            <motion.div initial="hidden" animate="show">
              <motion.span className="cx-chip" variants={rise} custom={0}>
                <span className="cx-live" /> الإصدار {CONNECT_VERSION} · مجاني
              </motion.span>
              <motion.h1 variants={rise} custom={1}>
                رحلتك على <em>اتصال</em>
                <br />
                بفريقك في كل لحظة
              </motion.h1>
              <motion.p className="cx-lead" variants={rise} custom={2}>
                South Street Connect يجمعك بفريق الوكالة ومرشدك: رسائل فورية ومكالمات صوتية واضحة، ترنّ مثل الهاتف حتى والتطبيق مغلق.
              </motion.p>
              <motion.div className="cx-ctas" variants={rise} custom={3}>
                {primary(detected, 'cx-cta is-primary')}
                <Link href="/connect" className="cx-cta is-ghost">فتح في المتصفح</Link>
              </motion.div>
              <motion.p className="cx-meta" variants={rise} custom={4}>
                {main.size ? <span>{main.size}</span> : null}
                <span className="cx-others">
                  متوفر أيضاً على
                  {others.map((p) => (
                    <button key={p} type="button" onClick={() => { setPlatform(p); document.getElementById('install')?.scrollIntoView({ behavior: 'smooth' }); }}>
                      {PLATFORMS[p].label}
                    </button>
                  ))}
                </span>
              </motion.p>
              <motion.ul className="cx-trust" variants={rise} custom={5}>
                <li><ShieldCheck /> اتصال مشفّر</li>
                <li><BellRing /> رنين حقيقي</li>
                <li><BatteryCharging /> خفيف على البطارية</li>
              </motion.ul>
            </motion.div>
            <PhoneMock />
          </div>
        </section>

        {/* ---------- features ---------- */}
        <section className="cx-section">
          <div className="cx-wrap">
            <motion.div className="cx-head" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
              <motion.span className="cx-eyebrow" variants={rise}>لماذا Connect</motion.span>
              <motion.h2 variants={rise} custom={1}>كل ما تحتاجه للتواصل أثناء الرحلة</motion.h2>
            </motion.div>
            <div className="cx-features">
              {FEATURES.map((f, i) => (
                <motion.article
                  key={f.title}
                  className="cx-feature"
                  variants={rise}
                  custom={i}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                >
                  <i><f.icon /></i>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- how a call reaches you ---------- */}
        <section className="cx-section is-dark">
          <div className="cx-wrap">
            <motion.div className="cx-head" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
              <motion.span className="cx-eyebrow" variants={rise}>كيف يعمل</motion.span>
              <motion.h2 variants={rise} custom={1}>مكالمة الوكالة تصلك أينما كنت</motion.h2>
            </motion.div>
            <ol className="cx-how">
              {HOW.map((s, i) => (
                <motion.li key={s.title} variants={rise} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.5 }}>
                  <span className="cx-how-num">{i + 1}</span>
                  <i><s.icon /></i>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- install ---------- */}
        <section className="cx-section" id="install">
          <div className="cx-wrap">
            <motion.div className="cx-head" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
              <motion.span className="cx-eyebrow" variants={rise}>التثبيت</motion.span>
              <motion.h2 variants={rise} custom={1}>جاهز في أقل من دقيقة</motion.h2>
            </motion.div>

            <div className="cx-tabs" role="tablist">
              {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
                const Icon = PLATFORMS[p].icon;
                return (
                  <button key={p} type="button" role="tab" aria-selected={platform === p} className={platform === p ? 'is-on' : ''} onClick={() => setPlatform(p)}>
                    {platform === p ? <motion.span layoutId="cx-tab" className="cx-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                    <Icon /> {PLATFORMS[p].label}
                  </button>
                );
              })}
            </div>

            <div className="cx-install">
              <AnimatePresence mode="wait">
                <motion.div
                  key={platform}
                  className="cx-steps-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <ol className="cx-steps">
                    {current.steps.map((s, i) => (
                      <li key={s}>
                        <span>{i + 1}</span>
                        <p>{s}</p>
                      </li>
                    ))}
                  </ol>
                  {platform === 'ios' ? (
                    <p className="cx-ios"><Share /> ثم <SquarePlus /> «إضافة إلى الشاشة الرئيسية»</p>
                  ) : null}
                  {current.note ? <p className="cx-note">{current.note}</p> : null}
                  {installNote ? <p className="cx-install-note" role="status">{installNote}</p> : null}
                  {primary(platform, 'cx-cta is-primary is-wide')}
                </motion.div>
              </AnimatePresence>

              {qr ? (
                <motion.div className="cx-qr" initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
                  <img src={qr} alt="رمز QR لفتح هذه الصفحة على الهاتف" />
                  <b>على الكمبيوتر؟</b>
                  <p>امسح الرمز بكاميرا هاتفك لتحميل التطبيق عليه.</p>
                </motion.div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="cx-section is-soft">
          <div className="cx-wrap cx-faq-wrap">
            <div className="cx-head">
              <span className="cx-eyebrow">أسئلة شائعة</span>
              <h2>قبل أن تبدأ</h2>
            </div>
            <div className="cx-faq">
              {FAQ.map((f, i) => (
                <div key={f.q} className={`cx-faq-item${open === i ? ' is-open' : ''}`}>
                  <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    {f.q}
                    <ChevronDown />
                  </button>
                  <AnimatePresence initial={false}>
                    {open === i ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <p>{f.a}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ))}
            </div>
            <p className="cx-signin">
              التطبيق لأصحاب الحسابات فقط: سجّل الدخول بحسابك في ساوث ستريت ثم نزّله. ليس لديك حساب؟ <Link href="/book">احجز رحلتك</Link> أو تواصل مع الوكالة.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      {loginOpen ? <LoginModal onClose={() => setLoginOpen(false)} redirectTo={loginRedirect} /> : null}
    </div>
  );
}
