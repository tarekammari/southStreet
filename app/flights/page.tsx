'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Luggage, Phone, PlaneTakeoff, Ticket } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { telHref } from '@/lib/brand';
import './flights.css';

/** Flight booking is not open yet: the home page's Air Algérie section leads here. */
const SOON = [
  { icon: PlaneTakeoff, title: 'كل الوجهات', text: 'من الجزائر إلى مدن العالم: البقاع المقدسة، تركيا، أوروبا، آسيا وغيرها.' },
  { icon: CalendarDays, title: 'مواعيد واضحة', text: 'تختار تاريخ الذهاب والعودة وترى الأماكن المتاحة.' },
  { icon: Luggage, title: 'الأمتعة والدرجة', text: 'الوزن المسموح والدرجة والسعر قبل الحجز.' },
  { icon: Ticket, title: 'تذكرتك في حسابك', text: 'الحجز والتذكرة في «حجوزاتي» دون تنقل.' },
];

export default function FlightsPage() {
  const agency = useAgencyInfo();
  const phone = agency.phone;

  return (
    <div className="page-shell min-h-screen bg-white">
      <Navbar variant="light" />
      <main className="fl page-main" dir="rtl">
        <section className="fl-hero">
          <img src="/images/AIR_ALGERIA.webp" alt="طائرة الخطوط الجوية الجزائرية" className="fl-hero-img" fetchPriority="high" decoding="async" />
          <div className="fl-hero-shade" />
          <div className="fl-hero-copy">
            <span className="fl-badge"><span className="fl-dot" /> قريباً</span>
            <p className="fl-kicker">Air Algérie · الخطوط الجوية الجزائرية</p>
            <h1>حجز تذاكر الطيران</h1>
            <p className="fl-lead">
              نعمل على فتح حجز تذاكر الطيران إلى كل الوجهات حول العالم مباشرة من الموقع. إلى ذلك الحين، الوكالة تحجز لكم رحلتكم بالهاتف أو مع أحد برامجنا.
            </p>
            <div className="fl-actions">
              <Link href="/trips" className="fl-btn fl-btn-main">رحلاتنا وبرامجنا <ArrowLeft className="w-4 h-4" /></Link>
              {phone && (
                <a href={telHref(phone)} className="fl-btn fl-btn-ghost"><Phone className="w-4 h-4" /> <span dir="ltr">{phone}</span></a>
              )}
            </div>
          </div>
        </section>

        <section className="fl-soon">
          <h2>ما الذي سيأتي</h2>
          <div className="fl-grid">
            {SOON.map(({ icon: Icon, title, text }) => (
              <div key={title} className="fl-card">
                <span className="fl-card-icon"><Icon className="w-5 h-5" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <Link href="/" className="fl-back">العودة إلى الصفحة الرئيسية</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
