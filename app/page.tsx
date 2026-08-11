'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import PromoBillboard from '@/components/PromoBillboard';
import OfferCard from '@/components/OfferCard';
import { Offer, User } from '@/types';
import SakhrAgent from '@/components/SakhrAgent';
import AgencySection from '@/components/AgencySection';
import Link from 'next/link';

const OFFERS_DATA: Offer[] = [
  {
    id: 'OFF-01',
    code: '02-34-456-001',
    title_ar: 'عمرة 10 أوت 2026 المتميزة',
    title_fr: 'Omra 10 Août 2026 Prestige',
    wilaya: 'برج بوعريريج',
    duration: '15 يوم',
    flight_type: 'مباشرة (Direct)',
    departure_date: 'الاثنين، 10 أوت 2026',
    airline: 'الخطوط الجوية الجزائرية',
    makkah_hotel: 'فندق منارات غزة / ميسان المقام',
    makkah_dist: '350م - 600م',
    price_quin: '215,000 دج',
    views: 6,
    img: '/images/kaaba_sharifa_home_page.png',
  },
  {
    id: 'OFF-02',
    code: '05-99-780-002',
    title_ar: 'عمرة المولد النبوي الشريف (سويس أوتيل)',
    title_fr: 'Omra Mawlid Ennabawi',
    wilaya: 'الجزائر العاصمة',
    duration: '15 يوم',
    flight_type: 'مباشرة (Direct)',
    departure_date: 'الخميس، 15 أوت 2026',
    airline: 'الخطوط السعودية',
    makkah_hotel: 'فندق سويس أوتيل المقام',
    makkah_dist: '50م من الحرم',
    price_quin: '295,000 دج',
    views: 9,
    img: '/images/kaaba_sharifa_home_page.png',
  },
];

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedWilaya, setSelectedWilaya] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('south_street_user');
    if (sessionStr) {
      try {
        setCurrentUser(JSON.parse(sessionStr));
      } catch {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('south_street_user');
    localStorage.removeItem('south_street_token');
    setCurrentUser(null);
  };

  const handleSelectRole = (code: string, name: string) => {
    const sessionStr = localStorage.getItem('south_street_user');
    if (sessionStr) {
      try {
        setCurrentUser(JSON.parse(sessionStr));
      } catch {}
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-app">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onSelectRole={handleSelectRole}
      />

      <main className="flex-1">
        {/* Section 1 — Hero */}
        <HeroSection />

        {/* Section 2 — Agency Presentation with sliding background */}
        <AgencySection />

        {/* AI Agent Sakhr (floating) */}
        <SakhrAgent />

        {/* Promo Billboard */}
        <PromoBillboard />

        {/* Offers Grid */}
        <section id="offers-section" className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-soft text-emerald-main px-3.5 py-1 rounded-full text-xs font-bold border border-emerald-light">
              باقات حصرية ومضمونة
            </div>
            <h2 className="text-3xl font-black text-slate-900 font-ruqaa">أحدث عروض العمرة والحج المضافة</h2>
            <p className="text-slate-500 text-xs max-w-md mx-auto">اختر باقتك المفضلة للإقامة في مكة والمدينة بأرقى الفنادق الفاخرة والطيران المباشر</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {OFFERS_DATA.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onSelect={(off) => setSelectedOffer(off)}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Offer Detail Modal */}
      {selectedOffer && (
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedOffer(null)}>
          <div
            className="bg-slate-900 border-2 border-gold-main rounded-2xl p-6 w-full max-w-lg shadow-2xl text-right text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gold-main font-cairo">{selectedOffer.title_ar}</h3>
              <span className="text-xs bg-emerald-main text-white px-2.5 py-1 rounded font-bold">{selectedOffer.duration}</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div>📍 <strong>الولاية:</strong> {selectedOffer.wilaya}</div>
              <div>✈️ <strong>الرحلة:</strong> {selectedOffer.airline} ({selectedOffer.flight_type})</div>
              <div>🏨 <strong>فندق مكة:</strong> {selectedOffer.makkah_hotel} ({selectedOffer.makkah_dist})</div>
              <div>📅 <strong>تاريخ الانطلاق:</strong> {selectedOffer.departure_date}</div>
              <div className="text-base font-black text-gold-main pt-2">السعر الإجمالي: {selectedOffer.price_quin} / للشخص</div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  alert(`تم تسجيل طلب حجز العرض (${selectedOffer.code}) بنجاح!`);
                  setSelectedOffer(null);
                }}
                className="flex-1 bg-gradient-to-r from-gold-dark via-gold-main to-gold-dark text-slate-950 font-black py-2.5 rounded-xl text-xs hover:brightness-110 shadow-lg"
              >
                تأكيد حجز مقعدك
              </button>
              <button
                onClick={() => setSelectedOffer(null)}
                className="bg-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 text-white pt-12 pb-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800">
          <div className="space-y-3">
            <img src="/images/south_street_logo_white_white.png" alt="SOUTH STREET" className="h-12 w-auto object-contain" />
            <p className="text-xs text-slate-400 leading-relaxed font-amiri">
              وكالة سوث ستريت للرحلات والتنظيم الفاخر للعمرة والحج. تواصل مشفر بالكامل وخيارات إقامة فاخرة بجوار الحرم المكي الشريف.
            </p>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <h4 className="font-bold text-gold-main text-sm mb-2 font-cairo">روابط سريعة</h4>
            <div><Link href="/portal?tab=rituals" className="hover:text-white">دليل طواف وسعي العمرة</Link></div>
            <div><Link href="/portal?tab=chat" className="hover:text-white">قناة المحادثة المشفرة E2E</Link></div>
            <div><Link href="/portal" className="hover:text-white">بوابة الأكواد للأدوار الخمسة</Link></div>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <h4 className="font-bold text-gold-main text-sm mb-2 font-cairo">التواصل والخصوصية</h4>
            <div>البريد: info@south-street.com</div>
            <div>الهاتف: +966 50 123 4567</div>
            <div className="text-emerald-400 font-bold mt-2">● بروتوكول الأمان AES-256 مفعّل</div>
          </div>
        </div>
        <div className="text-center text-xs text-slate-500 pt-6">
          © 2026 وكالة سوث ستريت SOUTH STREET Agency. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}
