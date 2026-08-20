'use client';

import React from 'react';
import { ChevronDown, PlaneTakeoff, Building2, Sparkles, BadgeCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HeroSection() {
  const scrollToAgency = () => {
    const el = document.getElementById('agency-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero-section" className="hero-clean-section animate-fade-in relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
      
      {/* Content Grid */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 gap-6">
        
        {/* TOP ROW: Speech on Right | Equal-sized Glassy Transparent Options on Left */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start pt-2 sm:pt-4">
          
          {/* RIGHT SIDE: Short Speech with two-tone blue agency name inside white 16px rectangle & subtle shadow */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-right space-y-2 max-w-xl"
          >
            <span className="text-xs sm:text-sm font-bold text-amber-300 tracking-wider font-tajawal">خدمتكم شرف نعتز به</span>
            <p className="text-base sm:text-xl font-bold text-white font-cairo leading-loose drop-shadow-sm">
              وكالة{' '}
              <span className="inline-flex items-center gap-1 bg-white px-3 py-0.5 rounded-[4px] shadow-xl border border-blue-100 font-cairo mx-1 align-middle">
                <span className="text-blue-600 font-black text-base sm:text-xl md:text-2xl">ساوث</span>
                <span className="text-blue-950 font-black text-base sm:text-xl md:text-2xl">ستريت</span>
              </span>{' '}
              — رفيقكم الموثوق لأداء العمرة والحج بأعلى درجات الرفاهية والاطمئنان.
            </p>
          </motion.div>

          {/* LEFT SIDE: Options with MORE TRANSPARENCY and BIG font as now */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col items-start lg:items-end gap-3 w-full"
          >
            {/* Equal size cards with high transparency (bg-white/5) & big Cairo font size */}
            <div className="w-full max-w-sm sm:w-80 bg-white/5 backdrop-blur-md border border-white/15 shadow-xl rounded-2xl p-3.5 flex items-center gap-3.5 text-white font-black text-sm sm:text-base font-cairo hover:bg-white/15 hover:border-gold-main/40 transition-all">
              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 shadow-md shrink-0">
                <PlaneTakeoff className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="leading-snug tracking-normal drop-shadow">رحلات جوية مباشرة ومؤكدة</span>
            </div>

            <div className="w-full max-w-sm sm:w-80 bg-white/5 backdrop-blur-md border border-white/15 shadow-xl rounded-2xl p-3.5 flex items-center gap-3.5 text-white font-black text-sm sm:text-base font-cairo hover:bg-white/15 hover:border-gold-main/40 transition-all">
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/35 text-amber-300 shadow-md shrink-0">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="leading-snug tracking-normal drop-shadow">فنادق فاخرة بجوار الحرم الشريف</span>
            </div>

            <div className="w-full max-w-sm sm:w-80 bg-white/5 backdrop-blur-md border border-white/15 shadow-xl rounded-2xl p-3.5 flex items-center gap-3.5 text-white font-black text-sm sm:text-base font-cairo hover:bg-white/15 hover:border-gold-main/40 transition-all">
              <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/35 text-cyan-300 shadow-md shrink-0">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="leading-snug tracking-normal drop-shadow">تأطير ديني وإداري متكامل</span>
            </div>

            <div className="w-full max-w-sm sm:w-80 bg-white/5 backdrop-blur-md border border-white/15 shadow-xl rounded-2xl p-3.5 flex items-center gap-3.5 text-white font-black text-sm sm:text-base font-cairo hover:bg-white/15 hover:border-gold-main/40 transition-all">
              <div className="p-2 sm:p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/35 text-rose-300 shadow-md shrink-0">
                <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="leading-snug tracking-normal drop-shadow">أسعار شفافة وتسهيلات ميسرة</span>
            </div>
          </motion.div>

        </div>

        {/* BOTTOM CENTER: Offer Component & ENLARGED Price Badge */}
        <div className="w-full flex flex-col items-center justify-center gap-3 mt-auto pb-2">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 max-w-[330px] sm:max-w-sm w-full text-center shadow-2xl space-y-3 sm:space-y-4 text-white mx-3 sm:mx-4 overflow-visible"
          >
            {/* Arabesque Spinning ENLARGED Price Badge — Keeping exact design */}
            <div className="absolute -top-7 -left-5 sm:-top-10 sm:-left-9 z-30 w-24 h-24 sm:w-36 sm:h-36 flex items-center justify-center pointer-events-none">
              <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-dashed border-gold-main arabesque-spin shadow-[0_0_20px_rgba(212,175,55,0.65)]"></div>
              <div className="absolute inset-1.5 sm:inset-2.5 rounded-full border border-gold-main/50 arabesque-spin" style={{ animationDirection: 'reverse', animationDuration: '28s' }}></div>

              {/* Red Circle — static inner */}
              <div className="relative w-16 h-16 sm:w-[105px] sm:h-[105px] rounded-full bg-gradient-to-br from-red-600 via-red-700 to-rose-900 border-2 sm:border-3 border-white flex flex-col items-center justify-center shadow-2xl text-center font-cairo pointer-events-auto">
                <span className="text-[8px] sm:text-[10px] font-bold text-amber-200 tracking-widest uppercase leading-none font-tajawal">ابتداءً من</span>
                <span className="text-sm sm:text-2xl font-black text-white leading-none tracking-tight font-cairo mt-0.5 sm:mt-1 drop-shadow-md">215,000</span>
                <span className="text-[8px] sm:text-[10px] font-bold text-amber-200 leading-none mt-0.5 font-tajawal">دج</span>
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
              onClick={() => { window.location.href = '/packages'; }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl shadow-xl transition-all duration-200 cursor-pointer border border-emerald-400/60 font-tajawal tracking-wide"
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
            className="z-20 flex items-center gap-1 text-white/90 hover:text-white transition-all cursor-pointer group pt-1"
            aria-label="اسحب للأسفل"
          >
            <span className="text-[10px] sm:text-[11px] font-bold font-tajawal bg-slate-900/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-lg group-hover:border-gold-main group-hover:bg-slate-900/90 transition-colors">
              اسحب للأسفل لاستكشاف الوكالة
            </span>
            <ChevronDown className="w-4 h-4 text-gold-main animate-bounce" />
          </motion.button>

        </div>

      </div>
    </section>
  );
}
