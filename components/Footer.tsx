'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import { publicList } from '@/lib/public-catalog';
import { PageContentRow, pickPageContent } from '@/lib/page-content';
import { SOCIAL_LABELS, waLink, withUtm } from '@/lib/social';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON, WhatsAppIcon } from '@/components/social/SocialIcons';
import { toPortalRole } from '@/lib/roles';
import PhoneQr from '@/components/PhoneQr';
import { Smartphone } from 'lucide-react';

const PRODUCT_LINKS = [
  { label: 'حجز العمرة', href: '/book' },
  { label: 'البرامج', href: '/packages' },
  { label: 'الفنادق', href: '/hotels' },
  { label: 'دليل العمرة', href: '/guide' },
  { label: 'تطبيق Connect', href: '/app' },
];

const COMPANY_LINKS = [
  { label: 'عن الوكالة', href: '/about' },
  { label: 'بوابة الوكالة', href: '/portal' },
  { label: 'لوحة التحكم', href: '/admin' },
  { label: 'تواصل معنا', href: '#contact' },
];

/** Shown until the agency settings load. */
const CONTACT_FALLBACK = [{ label: 'الجزائر العاصمة', href: '/about#contact' }];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function Footer({ content }: { content?: PageContentRow[] }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [rows, setRows] = useState<PageContentRow[]>(content || []);
  const [pilgrim, setPilgrim] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const footerInView = useInView(footerRef, { once: true, amount: 0.12 });

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
  const social = agency?.social;
  const wa = social?.whatsapp ? waLink(social.whatsapp, social.welcome) : '';
  const contactLinks = agency
    ? [
        agency.phone && { label: agency.phone, href: `tel:${agency.phone.replace(/\s+/g, '')}`, ltr: true },
        agency.email && { label: agency.email, href: `mailto:${agency.email}`, ltr: true },
        (agency.address || agency.city) && { label: agency.city || agency.address || '', href: '/about#contact' },
      ].filter(Boolean) as { label: string; href: string; ltr?: boolean }[]
    : CONTACT_FALLBACK;
  const profiles = social
    ? (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((k) => social[k]).map((k) => ({ key: k, url: social[k], label: SOCIAL_LABELS[k] }))
    : [];

  const news = pickPageContent(rows, 'footer_newsletter', {
    title: 'لا تفوّتوا جديدنا',
    content: 'أدخلوا بريدكم الإلكتروني للأخبار وتحديثات الرحلات',
  });

  // The Umrah guide is public now, so every visitor (pilgrims too) keeps it.
  const productLinks = PRODUCT_LINKS;
  const companyLinks = COMPANY_LINKS.map((link) =>
    pilgrim && link.href === '/portal'
      ? { label: 'برنامجي', href: '/portal?tab=program' }
      : link
  );

  return (
    <motion.footer
      ref={footerRef}
      id="contact"
      className="ss-footer"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ss-footer-bg" aria-hidden="true">
        <span className="ss-footer-orb ss-footer-orb--1" />
        <span className="ss-footer-orb ss-footer-orb--2" />
        <span className="ss-footer-orb ss-footer-orb--3" />
      </div>

      <div className="ss-footer-card">
        <div className="ss-footer-top">
          <motion.form
            className="ss-footer-news"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              setSent(true);
            }}
          >
            <motion.h2 className="ss-footer-news-title" variants={itemVariants}>
              {news.title}
            </motion.h2>
            <motion.p className="ss-footer-news-copy" variants={itemVariants}>
              {news.content}
            </motion.p>
            {sent ? (
              <motion.p
                className="ss-footer-thanks"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                تم تسجيل بريدكم. سنوافيكم بأقرب العروض.
              </motion.p>
            ) : (
              <motion.label className="ss-footer-field" variants={itemVariants}>
                <span className="sr-only">البريد الإلكتروني</span>
                <input
                  type="email"
                  required
                  dir="ltr"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <motion.button
                  type="submit"
                  aria-label="إرسال"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </motion.button>
              </motion.label>
            )}
          </motion.form>

          <motion.div
            className="ss-footer-cols has-qr"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.nav aria-label="البرامج" variants={itemVariants}>
              <h3>البرامج</h3>
              {productLinks.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
            </motion.nav>
            <motion.nav aria-label="الوكالة" variants={itemVariants}>
              <h3>الوكالة</h3>
              {companyLinks.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
            </motion.nav>
            <motion.nav aria-label="التواصل" variants={itemVariants}>
              <h3>التواصل</h3>
              {contactLinks.map((link) => (
                <a key={link.href} href={link.href} dir={'ltr' in link && link.ltr ? 'ltr' : undefined}>{link.label}</a>
              ))}
              {wa ? (
                <a href={withUtm(wa, 'website', 'footer')} target="_blank" rel="noreferrer" className="ss-wa-btn is-small" style={{ marginTop: 6, width: 'fit-content' }}>
                  <WhatsAppIcon /> راسلنا على واتساب
                </a>
              ) : null}
              {profiles.length ? (
                <div className="ss-socials" style={{ marginTop: 8 }}>
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
            </motion.nav>
            {/* Desktop / tablet: continue on the phone by scanning (hidden on phones). */}
            <motion.div className="ss-footer-qr" variants={itemVariants}>
              <h3><Smartphone className="w-4 h-4" aria-hidden /> على هاتفك</h3>
              <PhoneQr source="footer" size={124} />
              <p>امسح الرمز بكاميرا هاتفك لتفتح الموقع وتتابع الحجز من هناك.</p>
              <Link href="/app" className="ss-footer-qr-link">أو ثبّت تطبيق Connect ←</Link>
            </motion.div>
          </motion.div>
        </div>

        <div className="ss-footer-bottom">
          <motion.p
            className="ss-footer-legal"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <a href="#contact">شروط الخدمة</a>
            <a href="#contact">سياسة الخصوصية</a>
          </motion.p>
        </div>
      </div>

      <motion.div
        className="ss-footer-strip"
        initial={{ opacity: 0, y: 22 }}
        animate={footerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="ss-footer-strip-inner">
          <Link href="/" className="ss-footer-meta-logo" aria-label="South Street Home">
            <img
              src="/images/south_street_logo.png"
              alt=""
              className="ss-footer-logo"
              onError={(e) => {
                // Fall back once only: a second failure must not retry in a loop.
                const img = e.currentTarget;
                img.onerror = null;
                if (!img.src.endsWith('/images/south_street_logo_trans.png')) img.src = '/images/south_street_logo_trans.png';
              }}
            />
          </Link>
          <span className="ss-footer-meta-sep" aria-hidden="true" />
          <span className="ss-footer-status">الخدمة متاحة</span>
          <span className="ss-footer-copy">© 2026 وكالة ساوث ستريت</span>
        </div>
      </motion.div>
    </motion.footer>
  );
}
