'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import { fetchJsonList } from '@/lib/fetch-json';
import { PageContentRow, pickPageContent } from '@/lib/page-content';

const PRODUCT_LINKS = [
  { label: 'حجز العمرة', href: '/book' },
  { label: 'الباقات', href: '/packages' },
  { label: 'الفنادق', href: '/hotels' },
  { label: 'برامج السفر', href: '/#programs-section' },
  { label: 'دليل العمرة', href: '/portal?tab=rituals' },
];

const COMPANY_LINKS = [
  { label: 'عن الوكالة', href: '/#about-section' },
  { label: 'بوابة الوكالة', href: '/portal' },
  { label: 'لوحة التحكم', href: '/admin' },
  { label: 'تواصل معنا', href: '#contact' },
];

const CONTACT_LINKS = [
  { label: 'info@south-street.com', href: 'mailto:info@south-street.com' },
  { label: '+213 21 55 44 33', href: 'tel:+21321554433' },
  { label: 'الجزائر العاصمة', href: '#contact' },
];

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
  const footerRef = useRef<HTMLElement>(null);
  const footerInView = useInView(footerRef, { once: true, amount: 0.12 });

  useEffect(() => {
    if (content && content.length > 0) {
      setRows(content);
      return;
    }
    fetchJsonList<PageContentRow>('/api/admin/content').then(setRows);
  }, [content]);

  const news = pickPageContent(rows, 'footer_newsletter', {
    title: 'لا تفوّتوا جديدنا',
    content: 'أدخلوا بريدكم الإلكتروني للأخبار وتحديثات الرحلات',
  });

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
            className="ss-footer-cols"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.nav aria-label="البرامج" variants={itemVariants}>
              <h3>البرامج</h3>
              {PRODUCT_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
            </motion.nav>
            <motion.nav aria-label="الوكالة" variants={itemVariants}>
              <h3>الوكالة</h3>
              {COMPANY_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
            </motion.nav>
            <motion.nav aria-label="التواصل" variants={itemVariants}>
              <h3>التواصل</h3>
              {CONTACT_LINKS.map((link) => (
                <a key={link.href} href={link.href}>{link.label}</a>
              ))}
            </motion.nav>
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
                (e.target as HTMLImageElement).src = '/images/south_street_logo_trans.png';
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
