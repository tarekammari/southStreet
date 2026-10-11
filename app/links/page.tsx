'use client';

/**
 * "Link in bio" page for Facebook / Instagram / TikTok profiles: one link that
 * leads to WhatsApp, the programs, booking and the guide. Every button carries
 * UTM tags so the team can see which network brought the visit.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarCheck, ChevronLeft, Info, Phone, Plane } from 'lucide-react';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON, WhatsAppIcon } from '@/components/social/SocialIcons';
import { SOCIAL_LABELS, waLink, withUtm } from '@/lib/social';
import { fetchJsonList } from '@/lib/fetch-json';

type Pkg = { package_id: string; name: string; start_date?: string };

function sourceFromUrl(): string {
  if (typeof window === 'undefined') return 'bio';
  return new URLSearchParams(window.location.search).get('utm_source') || 'bio';
}

export default function LinksPage() {
  const agency = useAgencyInfo();
  const [programs, setPrograms] = useState<Pkg[]>([]);
  const [source, setSource] = useState('bio');

  useEffect(() => {
    setSource(sourceFromUrl());
    fetchJsonList<Pkg>('/api/admin/packages').then((list) => {
      const today = new Date().toISOString().slice(0, 10);
      setPrograms(list.filter((p) => !p.start_date || p.start_date >= today).slice(0, 3));
    });
  }, []);

  const social = agency?.social;
  const tag = (path: string) => (typeof window === 'undefined' ? path : withUtm(`${window.location.origin}${path}`, source, 'links'));
  const wa = social?.whatsapp ? withUtm(waLink(social.whatsapp, social.welcome), source, 'links') : '';
  const profiles = social
    ? (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((k) => social[k]).map((k) => ({ key: k, url: social[k], label: SOCIAL_LABELS[k] }))
    : [];

  const buttons = [
    { href: tag('/packages'), icon: Plane, title: 'برامج العمرة والحج', note: 'التواريخ والأسعار والفنادق' },
    { href: tag('/book'), icon: CalendarCheck, title: 'احجز رحلتك', note: 'طلب حجز في دقائق' },
    { href: tag('/guide'), icon: BookOpen, title: 'دليل العمرة خطوة بخطوة', note: 'المناسك والأدعية وقائمة التجهيز' },
    { href: tag('/about'), icon: Info, title: 'تعرّف على الوكالة', note: 'فريقنا ومرشدونا' },
  ];

  return (
    <main className="ssl" dir="rtl">
      <div className="ssl-card">
        <img src="/images/south_street_logo_trans.png" alt="South Street" className="ssl-logo" />
        <h1>{agency?.agency_name || 'ساوث ستريت للأسفار والعمرة'}</h1>
        <p className="ssl-tag">رحلات العمرة والحج من الجزائر · مرافقة دينية · فنادق قريبة من الحرم</p>

        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className="ssl-wa">
            <WhatsAppIcon className="w-5 h-5" />
            <span>
              <b>راسلنا على واتساب</b>
              <small>ردّ سريع من صخر، مساعدنا الذكي، أو من فريق الوكالة</small>
            </span>
          </a>
        ) : null}

        {programs.length ? (
          <section className="ssl-programs" aria-label="أقرب البرامج">
            <h2>أقرب البرامج</h2>
            {programs.map((p) => (
              <a key={p.package_id} href={tag(`/packages#${encodeURIComponent(p.package_id)}`)} className="ssl-program">
                <span>{p.name}</span>
                <ChevronLeft className="w-4 h-4" />
              </a>
            ))}
          </section>
        ) : null}

        <nav className="ssl-links">
          {buttons.map((b) => (
            <a key={b.title} href={b.href} className="ssl-link">
              <i><b.icon className="w-5 h-5" /></i>
              <span><b>{b.title}</b><small>{b.note}</small></span>
              <ChevronLeft className="w-4 h-4 ssl-chev" />
            </a>
          ))}
          {agency?.phone ? (
            <a href={`tel:${agency.phone.replace(/\s+/g, '')}`} className="ssl-link">
              <i><Phone className="w-5 h-5" /></i>
              <span><b>اتصل بنا</b><small dir="ltr">{agency.phone}</small></span>
              <ChevronLeft className="w-4 h-4 ssl-chev" />
            </a>
          ) : null}
        </nav>

        {profiles.length ? (
          <div className="ss-socials ssl-socials">
            {profiles.map((p) => {
              const Icon = SOCIAL_ICON[p.key];
              return (
                <a key={p.key} href={p.url} target="_blank" rel="noreferrer" className="ss-social" aria-label={p.label} title={p.label}>
                  <Icon />
                </a>
              );
            })}
          </div>
        ) : null}

        <Link href="/" className="ssl-site">الموقع الرسمي</Link>
      </div>
    </main>
  );
}
