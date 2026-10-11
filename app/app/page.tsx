'use client';

/**
 * Download page of South Street Connect (/app): what the app does, and how to
 * install it on Android, iPhone and Windows — one tap where the browser allows,
 * clear steps where it does not (iPhone), and a QR code for computer visitors.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Bell, CheckCircle2, Download, Lock, MessageCircle, Mic, Monitor, PhoneCall, Share, Smartphone, SquarePlus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { versionLabel } from '@/lib/connect/version';
import '@/app/info-pages.css';

type Platform = 'android' | 'ios' | 'windows';

const FEATURES = [
  { icon: MessageCircle, title: 'رسائل فورية', text: 'تواصل مباشر مع فريق الوكالة ومرشدك قبل الرحلة وأثناءها.' },
  { icon: PhoneCall, title: 'مكالمات صوتية واضحة', text: 'صوت نقي بإلغاء الصدى والضجيج، ويتحمّل شبكة الجيل الرابع الضعيفة.' },
  { icon: Mic, title: 'رسائل صوتية', text: 'سجّل رسالتك بضغطة وأرسلها، مثالية في الحرم أو أثناء التنقل.' },
  { icon: Bell, title: 'إشعارات', text: 'تصلك الرسائل والمكالمات حتى والتطبيق مغلق.' },
  { icon: Lock, title: 'خاص وآمن', text: 'بحسابك في ساوث ستريت فقط؛ المعتمرون لا يرون أرقام بعضهم.' },
];

const STEPS: Record<Platform, { label: string; icon: typeof Smartphone; steps: string[] }> = {
  android: {
    label: 'أندرويد',
    icon: Smartphone,
    steps: ['افتح هذه الصفحة في متصفح Chrome على هاتفك.', 'اضغط زر «تثبيت التطبيق» أدناه، أو من قائمة ⋮ اختر «تثبيت التطبيق».', 'يظهر Connect في شاشتك الرئيسية مثل أي تطبيق.'],
  },
  ios: {
    label: 'آيفون',
    icon: Smartphone,
    steps: ['افتح هذه الصفحة في متصفح Safari على الآيفون.', 'اضغط زر المشاركة (المربع مع السهم) أسفل الشاشة.', 'اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».', 'افتح Connect من الشاشة الرئيسية وفعّل الإشعارات (iOS 16.4 أو أحدث).'],
  },
  windows: {
    label: 'ويندوز',
    icon: Monitor,
    steps: ['افتح هذه الصفحة في Microsoft Edge أو Google Chrome.', 'اضغط زر «تثبيت التطبيق» أدناه، أو أيقونة التثبيت في شريط العنوان.', 'يُضاف Connect إلى قائمة ابدأ وشريط المهام.'],
  },
};

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'windows';
}

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('android');
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => {
    setPlatform(detect());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/connect-sw.js', { scope: '/connect' }).catch(() => undefined);
    void QRCode.toDataURL(`${window.location.origin}/app?utm_source=qr`, { margin: 1, width: 360, color: { dark: '#064e3b', light: '#ffffff' } }).then(setQr);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice?.outcome === 'accepted') setInstalled(true);
    setInstallEvt(null);
  };

  const current = STEPS[platform];

  return (
    <div className="page-shell min-h-screen bg-white">
      <Navbar variant="light" />
      <main className="ip page-main" dir="rtl">
        <section className="ip-hero">
          <div className="ip-wrap ip-hero-grid">
            <div>
              <span className="ip-eyebrow"><Download className="w-4 h-4" /> تطبيق مجاني</span>
              <h1>South Street <em>Connect</em></h1>
              <p className="ip-lead" dir="ltr" style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 0 }}>v{versionLabel()}</p>
              <p className="ip-lead">رسائل ومكالمات صوتية واضحة بينك وبين فريق الوكالة ومرشدك، على أندرويد والآيفون وويندوز. بدون متجر تطبيقات: ثبّته من هنا في ثوانٍ.</p>
              <div className="ip-actions">
                {installed ? (
                  <span className="ip-btn is-primary"><CheckCircle2 className="w-4 h-4" /> تم التثبيت</span>
                ) : installEvt ? (
                  <button type="button" className="ip-btn is-primary" onClick={() => void install()}><Download className="w-4 h-4" /> تثبيت التطبيق</button>
                ) : (
                  <a href="#install" className="ip-btn is-primary"><Download className="w-4 h-4" /> طريقة التثبيت</a>
                )}
                <Link href="/connect" className="ip-btn is-ghost">فتح في المتصفح</Link>
              </div>
            </div>
            <div className="ap-phone" aria-hidden>
              <img src="/icons/connect-512.png" alt="" />
              <b>Connect</b>
              <span>ساوث ستريت</span>
            </div>
          </div>
        </section>

        <section className="ip-section">
          <div className="ip-wrap">
            <div className="ip-cards ap-features">
              {FEATURES.map((f) => (
                <article key={f.title} className="ip-card">
                  <i><f.icon className="w-5 h-5" /></i>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ip-section is-soft" id="install">
          <div className="ip-wrap">
            <div className="ip-head">
              <span className="ip-eyebrow">التثبيت</span>
              <h2 className="ip-h2">ثبّت Connect على جهازك</h2>
            </div>
            <div className="ap-platforms" role="tablist">
              {(Object.keys(STEPS) as Platform[]).map((p) => {
                const Icon = STEPS[p].icon;
                return (
                  <button key={p} type="button" role="tab" aria-selected={platform === p} className={platform === p ? 'is-on' : ''} onClick={() => setPlatform(p)}>
                    <Icon className="w-4 h-4" /> {STEPS[p].label}
                  </button>
                );
              })}
            </div>
            <div className="ap-install">
              <ol className="ap-steps">
                {current.steps.map((s, i) => (
                  <li key={s}><span>{i + 1}</span><p>{s}</p></li>
                ))}
                {platform === 'ios' ? (
                  <li className="ap-ios-hint"><Share className="w-4 h-4" /> ثم <SquarePlus className="w-4 h-4" /> «إضافة إلى الشاشة الرئيسية»</li>
                ) : installEvt ? (
                  <li className="ap-ios-hint"><button type="button" className="ip-btn is-primary" onClick={() => void install()}><Download className="w-4 h-4" /> تثبيت الآن</button></li>
                ) : null}
              </ol>
              {qr ? (
                <div className="ap-qr">
                  <img src={qr} alt="رمز QR لفتح الصفحة على الهاتف" />
                  <p>على الكمبيوتر؟ امسح الرمز بكاميرا هاتفك لفتح هذه الصفحة عليه.</p>
                </div>
              ) : null}
            </div>
            <p className="ap-note">تسجيل الدخول بحسابك في ساوث ستريت. ليس لديك حساب؟ <Link href="/book">احجز رحلتك</Link> أو تواصل مع الوكالة.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
