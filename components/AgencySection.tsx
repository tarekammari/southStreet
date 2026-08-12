'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SECTION2_IMAGES = [
  {
    src: '/images/section2_01.png',
    title: 'فندق منارات غزة وميسان المقام — مكة المكرمة',
    info: '📍 350م إلى 600م فقط عن صحن الحرم المكي الشريف • إعاشة كاملة',
  },
  {
    src: '/images/section2_02.png',
    title: 'مرافقة وإرشاد في مناسك العمرة خطوة بخطوة',
    info: '🤲 طاقم متخصص للتوجيه الفقهي والميداني في الطواف والسعي',
  },
  {
    src: '/images/section2_03.png',
    title: 'بوفيه مفتوح ووجبات يومية فاخرة',
    info: '🍽️ إفطار وعشاء يومي متنوع بأعلى معايير النظافة والجودة',
  },
  {
    src: '/images/section2_04.png',
    title: 'زيارة الروضة الشريفة والمسجد النبوي',
    info: '🕌 استخراج تصاريح تطبيق نسك ودخول الروضة بكل سهولة',
  },
  {
    src: '/images/section2_05.png',
    title: 'رحلات جوية مباشرة بدون توقف',
    info: '✈️ من الجزائر، وهران، وعنابة عبر الخطوط الجوية الجزائرية والسعودية',
  },
  {
    src: '/images/section2_06.png',
    title: 'غرف مجهزة بأرقى الأثاث والتجهيزات الفندقية',
    info: '🛏️ تكييف مركزي، شاشات ذكية، وخدمة الغرف على مدار 24 ساعة',
  },
  {
    src: '/images/section2_07.png',
    title: 'حافلات حديثة ومكيفة لنقل المعتمرين',
    info: '🚌 التنقل بين مكة والمدينة والمطار في حافلات VIP فاخرة',
  },
  {
    src: '/images/section2_08.png',
    title: 'محادثات ودعم مباشر عبر البوابة المشفرة',
    info: '📱 قناة تواصل E2E خاصة بمجموعات المعتمرين لحل أي استفسار',
  },
  {
    src: '/images/section2_09.png',
    title: 'أكثر من 12 عاماً في خدمة ضيوف الرحمن',
    info: '🏆 وكالة معتمدة رسمياً ومصنفة ضمن أفضل وكالات العمرة بالجزائر',
  },
  {
    src: '/images/section2_10.png',
    title: 'استخراج التأشيرات والوثائق في أسرع وقت',
    info: '📄 نتكفل بجميع المعاملات والإجراءات الرسمية بدون عناء',
  },
];

export default function AgencySection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SECTION2_IMAGES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const activeItem = SECTION2_IMAGES[current];

  return (
    <section className="w-full relative overflow-hidden">
      {/* ── FULL BLEED WIDTH & FULL VIEWPORT HEIGHT AUTOMATIC SLIDESHOW ── */}
      <div className="relative w-full h-[85vh] sm:h-screen rounded-2xl md:rounded-3xl overflow-hidden bg-slate-950 flex items-end justify-center pb-10 sm:pb-14">
        
        {/* AUTOMATIC CROSS-FADE IMAGES */}
        {SECTION2_IMAGES.map((item, i) => (
          <motion.img
            key={item.src}
            src={item.src}
            alt={item.title}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{
              opacity: i === current ? 1 : 0,
              scale: i === current ? 1 : 1.05,
            }}
            transition={{
              opacity: { duration: 1.1, ease: 'easeInOut' },
              scale: { duration: 3.5, ease: 'easeOut' },
            }}
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
            style={{ zIndex: i === current ? 2 : 1 }}
          />
        ))}

        {/* ELEGANT GLASSY TRANSPARENT TEXT COMPONENT */}
        <div className="relative z-10 w-full max-w-xl mx-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="bg-slate-950/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 text-white shadow-2xl text-right font-tajawal space-y-1"
            >
              <h3 className="text-base sm:text-lg md:text-xl font-black text-amber-300 font-cairo leading-snug">
                {activeItem.title}
              </h3>
              <p className="text-xs sm:text-sm font-bold text-slate-100 leading-relaxed">
                {activeItem.info}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
