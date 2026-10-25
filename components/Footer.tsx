'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, MapPin, MessageCircle, Phone, PhoneCall, Smartphone } from 'lucide-react';
import { publicList } from '@/lib/public-catalog';
import { PageContentRow, pickPageContent } from '@/lib/page-content';
import { socialProfiles } from '@/lib/social';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON } from '@/components/social/SocialIcons';
import { toPortalRole } from '@/lib/roles';
import PhoneQr from '@/components/PhoneQr';
import { agencyLabel, connectName, telHref } from '@/lib/brand';
import '@/app/footer.css';

const PRODUCT_LINKS = [
  { label: 'حجز العمرة', href: '/book' },
  { label: 'البرامج', href: '/packages' },
  { label: 'رحلات سياحية', href: '/packages?kind=tourism' },
  { label: 'الفنادق', href: '/hotels' },
  { label: 'دليل العمرة', href: '/guide' },
];

const COMPANY_LINKS = [
  { label: 'عن الوكالة', href: '/about' },
  { label: 'بوابة الوكالة', href: '/portal' },
  { label: 'تطبيق Connect', href: '/app' },
  { label: 'لوحة التحكم', href: '/admin' },
];

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/** `hideCta`: the page already offers Connect (e.g. the About page's contact section). */
export default function Footer({ content, hideCta = false }: { content?: PageContentRow[]; hideCta?: boolean }) {
  const [rows, setRows] = useState<PageContentRow[]>(content || []);
  const [pilgrim, setPilgrim] = useState(false);

  useEffect(() => {
    if (content && content.length > 0) {
      setRows(content);
      return;
    }
    publicList<PageContentRow>('content').then(setRows);
  }, [content]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('south_street_user');
      if (!raw) return;
      const u = JSON.parse(raw);
      setPilgrim(toPortalRole(u.role, { email: u.email, roleName: u.roleName }) === 'pilgrim');
    } catch {
      /* ignore */
    }
  }, []);

  const agency = useAgencyInfo();
  const social = agency.social;
  const profiles = socialProfiles(social);

  const about = pickPageContent(rows, 'footer_about', {
    title: agency.agency_name,
    content: 'رحلات عمرة وحج منظّمة من الجزائر، بمرافقة دينية وفنادق قريبة من الحرم ومتابعة يومية حتى العودة.',
  });

  const contacts = [
    agency.phone && { icon: Phone, label: agency.phone, href: telHref(agency.phone), ltr: true },
    agency.email && { icon: Mail, label: agency.email, href: `mailto:${agency.email}`, ltr: true },
    { icon: MapPin, label: agency.city || agency.address, href: '/about#contact' },
  ].filter(Boolean) as { icon: typeof Phone; label: string; href: string; ltr?: boolean }[];

  const companyLinks = COMPANY_LINKS.map((link) =>
    pilgrim && link.href === '/portal' ? { label: 'برنامجي', href: '/portal?tab=program' } : link
  );

  return (
    <footer id="contact" className="sf" dir="rtl">
      <div className="sf-wrap">
        {/* Contact goes through Connect: messages and calls with the agency team. */}
        {hideCta ? null : (
        <motion.div
          className="sf-cta"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={rise}
          custom={0}
        >
          <span className="sf-cta-icon" aria-hidden><MessageCircle /></span>
          <div className="sf-cta-text">
            <h2>تحدّث مع فريق الوكالة مباشرة</h2>
            <p>رسائل ومكالمات صوتية مع مستشاريك ومرشدك عبر تطبيق {connectName(agency)}.</p>
          </div>
          <div className="sf-cta-actions">
            <Link href="/connect" className="sf-btn is-primary">
              <PhoneCall size={17} /> تواصل عبر Connect
            </Link>
            <Link href="/app" className="sf-btn is-ghost">ثبّت التطبيق</Link>
          </div>
        </motion.div>
        )}

        <div className="sf-grid">
          <motion.div className="sf-brand" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={1}>
            <Link href="/" aria-label={agency.name_latin}>
              <img src={agency.logo_url} alt={agency.name_latin} className="sf-logo" />
            </Link>
            <p>{about.content}</p>
            {profiles.length ? (
              <div className="sf-socials">
                {profiles.map((p) => {
                  const Icon = SOCIAL_ICON[p.key];
                  return (
                    <a key={p.key} href={p.url} target="_blank" rel="noreferrer" className="sf-social" aria-label={p.label} title={p.label}>
                      <Icon />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </motion.div>

          <motion.nav aria-label="الخدمات" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={2}>
            <h3>الخدمات</h3>
            {PRODUCT_LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </motion.nav>

          <motion.nav aria-label="الوكالة" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={3}>
            <h3>الوكالة</h3>
            {companyLinks.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </motion.nav>

          <motion.nav aria-label="التواصل" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={4}>
            <h3>التواصل</h3>
            {contacts.map((c) => (
              <a key={c.href} href={c.href} className="sf-contact">
                <c.icon size={15} aria-hidden />
                <span dir={c.ltr ? 'ltr' : undefined}>{c.label}</span>
              </a>
            ))}
          </motion.nav>

          {/* Desktop / tablet: continue on the phone by scanning (hidden on phones). */}
          <motion.div className="sf-qr" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={rise} custom={5}>
            <PhoneQr source="footer" size={96} />
            <div>
              <b><Smartphone size={14} aria-hidden /> على هاتفك</b>
              <span>امسح الرمز لتتابع من الهاتف</span>
            </div>
          </motion.div>
        </div>

        <div className="sf-bottom">
          <span>© {new Date().getFullYear()} {agencyLabel(agency)} · جميع الحقوق محفوظة</span>
          <span className="sf-status">الخدمة متاحة</span>
          <nav aria-label="روابط قانونية">
            <Link href="/about">شروط الخدمة</Link>
            <Link href="/about">سياسة الخصوصية</Link>
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="sf-top">
              للأعلى <ArrowLeft size={14} style={{ transform: 'rotate(90deg)' }} />
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
