'use client';

/**
 * "Link in bio" page for Facebook / Instagram / TikTok profiles: one link that
 * leads to Connect (chat with the agency), the programs, booking and the guide. Every button carries
 * UTM tags so the team can see which network brought the visit.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarCheck, ChevronLeft, Info, MessageCircle, Phone, Plane } from 'lucide-react';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON } from '@/components/social/SocialIcons';
import { socialProfiles, withUtm } from '@/lib/social';
import { publicList } from '@/lib/public-catalog';

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
    publicList<Pkg>('packages').then((list) => {
      const today = new Date().toISOString().slice(0, 10);
      setPrograms(list.filter((p) => !p.start_date || p.start_date >= today).slice(0, 3));
    });
  }, []);

  const social = agency?.social;
  const tag = (path: string) => (typeof window === 'undefined' ? path : withUtm(`${window.location.origin}${path}`, source, 'links'));
  const profiles = socialProfiles(social);

  const buttons = [
    { href: tag('/packages'), icon: Plane, title: 'برامج العمرة والحج', note: 'التواريخ والأسعار والفنادق' },
    { href: tag('/book'), icon: CalendarCheck, title: 'احجز رحلتك', note: 'طلب حجز في دقائق' },
    { href: tag('/guide'), icon: BookOpen, title: 'دليل العمرة خطوة بخطوة', note: 'المناسك والأدعية وقائمة التجهيز' },
    { href: tag('/about'), icon: Info, title: 'تعرّف على الوكالة', note: 'فريقنا ومرشدونا' },
  ];

  return (
    <main className="ssl" dir="rtl">
      <div className="ssl-card">
        <img src={agency.logo_url} alt={agency.name_latin} className="ssl-logo" />
        <h1>{agency.agency_name}</h1>
        <p className="ssl-tag">رحلات العمرة والحج من الجزائر · مرافقة دينية · فنادق قريبة من الحرم</p>

        <a href={tag('/connect')} className="ssl-wa">
          <MessageCircle className="w-5 h-5" />
          <span>
            <b>تحدّث معنا عبر Connect</b>
            <small>رسائل ومكالمات مباشرة مع فريق الوكالة</small>
          </span>
        </a>

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
