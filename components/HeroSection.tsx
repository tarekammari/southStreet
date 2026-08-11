'use client';

import React from 'react';

export default function HeroSection() {
  return (
    <section className="hero-clean-section animate-fade-in flex flex-col justify-end items-center pb-12 relative">
      <div className="relative z-10 bg-slate-900/65 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 md:p-7 max-w-sm w-full text-center shadow-2xl space-y-4 text-white mx-4">

        {/* Arabesque Spinning Price Badge — Top Left */}
        <div className="absolute -top-9 -left-9 z-20 w-28 h-28 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 rounded-full border-4 border-dashed border-gold-main arabesque-spin shadow-[0_0_20px_rgba(212,175,55,0.5)]"></div>
          <div className="absolute inset-2 rounded-full border border-gold-main/40 arabesque-spin" style={{ animationDirection: 'reverse', animationDuration: '28s' }}></div>

          {/* Red Circle — static inner */}
          <div className="relative w-[82px] h-[82px] rounded-full bg-gradient-to-br from-red-600 via-red-700 to-rose-900 border-2 border-white flex flex-col items-center justify-center shadow-2xl text-center font-cairo pointer-events-auto">
            <span className="text-[9px] font-bold text-amber-200 tracking-widest uppercase leading-none font-tajawal">ابتداءً من</span>
            <span className="text-xl font-black text-white leading-none tracking-tight font-cairo mt-0.5">215,000</span>
            <span className="text-[9px] font-bold text-amber-200 leading-none mt-0.5 font-tajawal">دج</span>
          </div>
        </div>

        <div className="space-y-2 pt-3">
          <h2 className="text-lg md:text-xl font-extrabold text-white font-cairo leading-snug">
            عمرة شهر أوت 2026 المميزة
          </h2>
          <p className="text-xs text-slate-300 font-tajawal font-medium leading-relaxed">
            طيران مباشر • إقامة فاخرة بجوار صحن الحرم المكي الشريف (350م - 600م)
          </p>
        </div>

        <button
          onClick={() => alert('تم تسجيل طلب حجزك في رحلة شهر أوت 2026. سنتواصل معك مباشرة.')}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-3.5 px-6 rounded-xl shadow-xl transition-all duration-200 cursor-pointer border border-emerald-400/60 font-tajawal tracking-wide"
        >
          احجز الآن
        </button>
      </div>
    </section>
  );
}
