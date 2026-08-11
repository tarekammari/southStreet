'use client';

import React from 'react';
import { ChevronRight, ChevronLeft, Sliders } from 'lucide-react';
import KaabaIcon from '@/components/icons/KaabaIcon';

export default function HeroSection() {
  const scrollToOffers = () => {
    const el = document.getElementById('offers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-clean-section animate-fade-in">
      {/* Tesla Carousel Edge Navigation Arrows */}
      <button
        onClick={scrollToOffers}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-md border border-white/40 text-slate-900 w-11 h-11 rounded-lg flex items-center justify-center cursor-pointer shadow-lg hover:bg-white hover:scale-105 transition-all"
        title="السابق"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={scrollToOffers}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-md border border-white/40 text-slate-900 w-11 h-11 rounded-lg flex items-center justify-center cursor-pointer shadow-lg hover:bg-white hover:scale-105 transition-all"
        title="التالي"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Hero Headline & Subtitle */}
      <div className="hero-tesla-content">
        <h1 className="hero-tesla-title">عمرة شهر أوت 2026</h1>
        <p className="hero-tesla-sub">رحلة إيمانية فاخرة وطيران مباشر بجوار صحن الحرم المكي الشريف</p>
        <div className="mt-3">
          <button
            onClick={scrollToOffers}
            className="text-gold-main font-extrabold underline underline-offset-4 text-base hover:text-white transition-colors cursor-pointer"
          >
            ابتداءً من 215,000 دج • احجز مكانك الآن
          </button>
        </div>
      </div>

      {/* Dual Center Action Buttons */}
      <div className="hero-tesla-actions">
        <button
          onClick={() => alert('تم تسجيل طلب حجز مقعدك في رحلة شهر أوت 2026. سنتواصل معك مباشرة.')}
          className="flex-1 bg-gradient-to-r from-emerald-main to-emerald-dark text-white font-extrabold text-base py-3 px-6 rounded-md hover:bg-emerald-light shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <KaabaIcon className="w-5 h-5 text-gold-main" />
          احجز الآن
        </button>
        <button
          onClick={scrollToOffers}
          className="flex-1 bg-white/90 backdrop-blur-md text-slate-900 font-extrabold text-base py-3 px-6 rounded-md hover:bg-white shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sliders className="w-5 h-5 text-emerald-main" />
          استكشف العروض
        </button>
      </div>
    </section>
  );
}
