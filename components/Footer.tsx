'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchJsonList } from '@/lib/fetch-json';
import { PageContentRow, pickPageContent } from '@/lib/page-content';

const PRODUCT_LINKS = [
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

export default function Footer({ content }: { content?: PageContentRow[] }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [rows, setRows] = useState<PageContentRow[]>(content || []);

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
      id="contact"
      className="ss-footer"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="ss-footer-mark"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      >
        ساوث ستريت
      </motion.div>

      <div className="ss-footer-card">
        <div className="ss-footer-top">
          <form
            className="ss-footer-news"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              setSent(true);
            }}
          >
            <h2 className="ss-footer-news-title">{news.title}</h2>
            <p className="ss-footer-news-copy">{news.content}</p>
            {sent ? (
              <p className="ss-footer-thanks">تم تسجيل بريدكم. سنوافيكم بأقرب العروض.</p>
            ) : (
              <label className="ss-footer-field">
                <span className="sr-only">البريد الإلكتروني</span>
                <input
                  type="email"
                  required
                  dir="ltr"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" aria-label="إرسال">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </label>
            )}
          </form>

          <div className="ss-footer-cols">
            <nav aria-label="البرامج">
              <h3>البرامج</h3>
              {PRODUCT_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
            </nav>
            <nav aria-label="الوكالة">
              <h3>الوكالة</h3>
              {COMPANY_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}</Link>
              ))}
            </nav>
            <nav aria-label="التواصل">
              <h3>التواصل</h3>
              {CONTACT_LINKS.map((link) => (
                <a key={link.href} href={link.href}>{link.label}</a>
              ))}
            </nav>
          </div>
        </div>

        <div className="ss-footer-bottom">
          <p>
            <span className="ss-footer-status">الخدمة متاحة</span>
            <span>© 2026 وكالة ساوث ستريت</span>
          </p>
          <p className="ss-footer-legal">
            <a href="#contact">شروط الخدمة</a>
            <a href="#contact">سياسة الخصوصية</a>
          </p>
        </div>
      </div>
    </motion.footer>
  );
}
