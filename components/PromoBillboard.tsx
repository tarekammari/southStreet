'use client';

import React from 'react';
import { Flame, PlaneTakeoff, Hotel, ShieldCheck, PlayCircle } from 'lucide-react';
import KaabaIcon from '@/components/icons/KaabaIcon';

export default function PromoBillboard() {
  return (
    <section className="max-w-6xl mx-auto my-12 px-6">
      <div className="bg-gradient-to-r from-emerald-deep via-emerald-dark to-slate-950 rounded-3xl border-2 border-gold-main p-8 md:p-10 shadow-2xl relative overflow-hidden text-white flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex-1 space-y-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gold-dark to-gold-main text-slate-950 font-black text-xs px-4 py-1.5 rounded-full shadow-md">
            <Flame className="w-4 h-4 text-red-600 fill-red-600" />
            عرض خاص محدود الأسرة • خروج شهر أوت 2026
          </div>

          <h2 className="text-3xl md:text-4xl font-black font-ruqaa leading-tight">
            عمرة شهر أوت المميزة: <span className="text-gold-main">رحلة إيمانية مباشرة إلى البقاع المقدسة</span>
          </h2>

          <p className="text-slate-200 text-sm md:text-base font-amiri leading-relaxed max-w-2xl">
            استمتع بأرقى خدمات الإقامة الفاخرة في مكة المكرمة بالقرب من الحرم المكي الشريف (فندق منارات غزة وميسان المقام) مع مرافقة إرشاديّة مفرغة وطيران مباشر عبر الخطوط الجوية الجزائرية والسعودية.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-bold flex items-center gap-2">
              <PlaneTakeoff className="w-4 h-4 text-gold-main" />
              رحلات مباشرة من الجزائر ووهران وعنابة
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-bold flex items-center gap-2">
              <Hotel className="w-4 h-4 text-gold-main" />
              350م - 600م فقط عن صحن الحرم
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gold-main" />
              تواصل ومكالمات مشفرة طوال الرحلة
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              onClick={() => alert('تم تسجيل طلب حجزك في رحلة شهر أوت 2026!')}
              className="bg-gradient-to-r from-gold-dark via-gold-main to-gold-dark text-slate-950 font-black text-base px-6 py-3 rounded-xl shadow-lg hover:scale-102 transition-all flex items-center gap-2 cursor-pointer"
            >
              <KaabaIcon className="w-5 h-5 text-slate-950" />
              احجز مقعدك في رحلة أوت الآن
            </button>
            <button
              onClick={() => alert('تشغيل فيديو معاينة الفنادق والرحلة')}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/40 font-bold text-sm px-5 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlayCircle className="w-5 h-5 text-gold-main" />
              شاهد فيديو الرحلة
            </button>
          </div>
        </div>

        <div className="relative shrink-0 w-full md:w-72">
          <img
            src="/images/kaaba_sharifa_home_page.png"
            alt="عمرة شهر أوت 2026"
            className="w-full h-52 object-cover rounded-2xl border-2 border-gold-main shadow-2xl"
          />
          <div className="absolute -bottom-3 -right-3 bg-red-600 text-white font-black text-sm px-4 py-1.5 rounded-xl shadow-lg border-2 border-white">
            ابتداءً من 215,000 دج
          </div>
        </div>
      </div>
    </section>
  );
}
