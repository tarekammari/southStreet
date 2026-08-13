'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Plane, Sparkles, Compass, ShieldCheck } from 'lucide-react';

type Program = {
  id: string;
  title: string;
  date: string;
  duration: string;
  departure: string;
  priceTag?: string;
  state: 'available' | 'upcoming';
  badgeText: string;
};

const programs: Program[] = [
  {
    id: 'p1',
    title: 'عمرة أغسطس المميزة',
    date: '10 أغسطس 2026',
    duration: '15 يوماً (مكة والمدينة)',
    departure: 'رحلة مباشرة عبر الخطوط السعودية',
    priceTag: 'شامل الإقامة والنقل',
    state: 'available',
    badgeText: 'متاح للحجز الآن',
  },
  {
    id: 'p2',
    title: 'عمرة المولد النبوي الشريف',
    date: '15 أغسطس 2026',
    duration: '15 يوماً (فنادق 5 نجوم)',
    departure: 'رحلة مباشرة مع المرشد الفقهي',
    priceTag: 'شامل المزارات والإرشاد',
    state: 'available',
    badgeText: 'متاح للحجز الآن',
  },
  {
    id: 'p3',
    title: 'عمرة ربيع الأول المباركة',
    date: 'سبتمبر 2026',
    duration: '15 يوماً',
    departure: 'التسجيل المسبق متاح الآن',
    state: 'upcoming',
    badgeText: 'قريباً — افتتح التسجيل',
  },
  {
    id: 'p4',
    title: 'برنامج حج 2027 المعتمد',
    date: 'موسم الحج القادم',
    duration: 'برنامج متكامل مع الإرشاد',
    departure: 'انضم لقائمة الاهتمام المباشرة',
    state: 'upcoming',
    badgeText: 'قريباً — قائمة الاهتمام',
  },
];

export default function TravelProgramsSection() {
  const availablePrograms = programs.filter((p) => p.state === 'available');
  const upcomingPrograms = programs.filter((p) => p.state === 'upcoming');

  return (
    <section id="programs-section" className="w-full my-6 sm:my-10 px-3 sm:px-6 font-tajawal">
      {/* ── MATCHING PREVIOUS SECTIONS WITH CORNER RADIUS & LIGHT MODE ── */}
      <div className="relative w-full rounded-2xl md:rounded-3xl bg-white border border-slate-200/90 shadow-xl overflow-hidden py-10 sm:py-16 px-4 sm:px-8 md:px-12 text-slate-900">
        
        {/* LIGHT DECORATIVE ACCENTS */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

        {/* ── HEADER ── */}
        <div className="relative z-10 max-w-7xl mx-auto mb-10 sm:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100"
          >
            <div className="space-y-3 text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-800 shadow-xs">
                <Plane className="h-4 w-4 text-emerald-600" />
                برامج رحلات العمرة والحج
              </span>

              <h2 className="font-cairo text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                اختر رحلتك <span className="text-emerald-600">القادمة</span>
              </h2>

              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                تعرّف على البرامج المتاحة للحجز الآن، وسجّل اهتمامك بالرحلات القادمة لضمان مكانك في الرحلات الإيمانية.
              </p>
            </div>

            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition-all duration-300 self-start md:self-auto group cursor-pointer"
            >
              <span>تواصل مع المستشار</span>
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </a>
          </motion.div>
        </div>

        {/* ── TWO COLUMNS GRID (AVAILABLE & UPCOMING) ── */}
        <div className="relative z-10 max-w-7xl mx-auto grid gap-8 lg:grid-cols-2">
          
          {/* AVAILABLE PROGRAMS COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 p-6 sm:p-8 shadow-sm flex flex-col justify-between"
          >
            <div>
              {/* Column Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <h3 className="font-cairo text-xl font-black text-slate-900">متاح الآن للحجز</h3>
                  <p className="text-xs font-semibold text-emerald-700">يمكنك تقديم طلب الحجز وتأكيد المقاعد اليوم</p>
                </div>
              </div>

              {/* Cards list */}
              <div className="space-y-4">
                {availablePrograms.map((prog) => (
                  <motion.article
                    key={prog.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                    className="group relative rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-xl hover:border-emerald-400 transition-all duration-300 text-right"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md mb-2">
                          <Compass className="w-3 h-3 text-emerald-600" />
                          {prog.badgeText}
                        </span>
                        <h4 className="font-cairo text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {prog.title}
                        </h4>
                      </div>
                      
                      <span className="shrink-0 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        {prog.duration}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                        {prog.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                        {prog.departure}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {prog.priceTag}
                      </span>
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 group-hover:text-emerald-900 transition-colors"
                      >
                        اطلب الحجز المباشر
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                      </a>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          </motion.div>

          {/* UPCOMING PROGRAMS COLUMN */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 sm:p-8 shadow-sm flex flex-col justify-between"
          >
            <div>
              {/* Column Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <h3 className="font-cairo text-xl font-black text-slate-900">رحلات قادمة (التسجيل المسبق)</h3>
                  <p className="text-xs font-semibold text-slate-500">سجّل اهتمامك لتصلك المواعيد والأسعار فور اعتمادها</p>
                </div>
              </div>

              {/* Cards list */}
              <div className="space-y-4">
                {upcomingPrograms.map((prog) => (
                  <motion.article
                    key={prog.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                    className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-lg hover:border-amber-400 transition-all duration-300 text-right"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-md mb-2">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          {prog.badgeText}
                        </span>
                        <h4 className="font-cairo text-lg font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                          {prog.title}
                        </h4>
                      </div>
                      
                      <span className="shrink-0 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        {prog.duration}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <CalendarDays className="h-3.5 w-3.5 text-amber-600" />
                        {prog.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        {prog.departure}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        الأولوية لأسبقية التسجيل
                      </span>
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-1 text-xs font-black text-amber-700 group-hover:text-amber-900 transition-colors"
                      >
                        سجّل اهتمامك
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                      </a>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center gap-2 text-xs text-slate-500 text-right">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>المواعيد والأسعار النهائية تُعلن فور اعتماد البرنامج رسمياً من وزارة الحج والعمرة.</span>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
