'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HeroSection() {
  const scrollToAgency = () => {
    const el = document.getElementById('agency-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-clean-section animate-fade-in flex flex-col justify-end items-center pb-8 sm:pb-14 relative overflow-hidden rounded-2xl md:rounded-3xl">
      <div className="flex flex-col justify-end items-center w-full h-full pb-8 sm:pb-14 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 max-w-[330px] sm:max-w-sm w-full text-center shadow-2xl space-y-3 sm:space-y-4 text-white mx-3 sm:mx-4 overflow-visible"
        >
          {/* Arabesque Spinning Price Badge — Scaled & Positioned for Mobile */}
          <div className="absolute -top-5 -left-4 sm:-top-8 sm:-left-8 z-30 w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-dashed border-gold-main arabesque-spin shadow-[0_0_15px_rgba(212,175,55,0.5)]"></div>
            <div className="absolute inset-1.5 sm:inset-2 rounded-full border border-gold-main/40 arabesque-spin" style={{ animationDirection: 'reverse', animationDuration: '28s' }}></div>

            {/* Red Circle — static inner */}
            <div className="relative w-14 h-14 sm:w-[82px] sm:h-[82px] rounded-full bg-gradient-to-br from-red-600 via-red-700 to-rose-900 border-2 border-white flex flex-col items-center justify-center shadow-2xl text-center font-cairo pointer-events-auto">
              <span className="text-[7px] sm:text-[9px] font-bold text-amber-200 tracking-widest uppercase leading-none font-tajawal">ابتداءً من</span>
              <span className="text-xs sm:text-xl font-black text-white leading-none tracking-tight font-cairo mt-0.5">215,000</span>
              <span className="text-[7px] sm:text-[9px] font-bold text-amber-200 leading-none mt-0.5 font-tajawal">دج</span>
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-2 sm:pt-3">
            <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-white font-cairo leading-snug">
              عمرة شهر أوت 2026 المميزة
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 font-tajawal font-medium leading-relaxed">
              طيران مباشر • إقامة فاخرة بجوار صحن الحرم المكي الشريف (350م - 600م)
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => alert('تم تسجيل طلب حجزك في رحلة شهر أوت 2026. سنتواصل معك مباشرة.')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-lg sm:rounded-xl shadow-xl transition-all duration-200 cursor-pointer border border-emerald-400/60 font-tajawal tracking-wide"
          >
            احجز الآن
          </motion.button>
        </motion.div>

        {/* Scroll Down Indicator */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          onClick={scrollToAgency}
          className="absolute bottom-2 sm:bottom-4 z-20 flex flex-col items-center gap-1 text-white/90 hover:text-white transition-all cursor-pointer group"
          aria-label="اسحب للأسفل"
        >
          <span className="text-[10px] sm:text-[11px] font-bold font-tajawal bg-slate-900/60 backdrop-blur-md px-3 sm:px-3.5 py-0.5 sm:py-1 rounded-full border border-white/20 shadow-lg group-hover:border-gold-main group-hover:bg-slate-900/80 transition-colors">
            اسحب للأسفل لاستكشاف الوكالة
          </span>
          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gold-main animate-bounce" />
        </motion.button>
      </div>
    </section>
  );
}
