'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PhoneCall } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
  image: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'm1',
    name: 'الشيخ د. عبد الرحمن النوي',
    role: 'مرشد ديني أول — مكة المكرمة',
    description: 'دكتوراه في الفقه وأصوله. متفرغ لإلقاء الدروس التوجيهية وتوجيه ضيوف الرحمن في المناسك.',
    image: '/api/staff-image/morshed_01.png',
  },
  {
    id: 'm2',
    name: 'الشيخ محمد الطيب',
    role: 'مرشد المناسك والمزارات — المدينة المنورة',
    description: 'متخصص في الشروح التاريخية للمزارات بالمدينة المنورة ومرافقة الحجاج في الروضة الشريفة.',
    image: '/api/staff-image/morshed_02.png',
  },
  {
    id: 'm3',
    name: 'الأستاذ فاروق بوزيد',
    role: 'مرشد ميداني وقائد مجموعات',
    description: 'يقود تفويج المجموعات في الحافلات والمطارات لضمان سلاسة حركة ضيوف الرحمن.',
    image: '/api/staff-image/morshed_03.png',
  },
  {
    id: 'm4',
    name: 'الشيخ ياسين العلي',
    role: 'مرشد التوجيه الروحي والمتابعة',
    description: 'مختص بالتواصل الفوري والإجابة عن استفسارات وفتاوى المعتمرين والعائلات.',
    image: '/api/staff-image/morshed_04.png',
  },
  {
    id: 'f1',
    name: 'الأستاذة مريم',
    role: 'مرشدة شؤون النساء والمناسك',
    description: 'متخصصة في إرشاد الأخوات في أحكام الإحرام والزيارات النسائية بالروضة الشريفة.',
    image: '/api/staff-image/morshed_women_01.png',
  },
  {
    id: 'f2',
    name: 'الأستاذة عائشة الجزائري',
    role: 'مرشدة التوجيه ورعاية الأخوات',
    description: 'مرافقة المعتمرات في الصلوات والزيارات ومتابعة الخدمات الخاصة بالنساء وكبار السن.',
    image: '/api/staff-image/morshed_women_02.png',
  },
  {
    id: 's1',
    name: 'الأستاذ أحمد المنصوري',
    role: 'المدير العام لوكالة ساوث ستريت',
    description: 'يشرف على التعاقدات الفندقية والخطوط الجوية وضمان تطبيق أعلى معايير الجودة والراحة.',
    image: '/api/staff-image/director_agancy.png',
  },
  {
    id: 's2',
    name: 'السيد توفيق بوجمعة',
    role: 'مدير العمليات اللوجستية والنقل',
    description: 'مسؤول عن حجز الحافلات الحديثة VIP وتنسيق الرحلات الجوية ومواعيد الاستقبال.',
    image: '/api/staff-image/team_member_01.png',
  },
  {
    id: 's3',
    name: 'الأستاذة سارة بن علي',
    role: 'مسؤولة التأشيرات وتنسيق الرحلات',
    description: 'تتولى إصدار التأشيرات الإلكترونية وتصاريح تطبيق نسك ودعم المعتمرين.',
    image: '/api/staff-image/team_member_06.png',
  },
  {
    id: 's4',
    name: 'السيد كريم يوسفي',
    role: 'منسق الإقامة والإعاشة الفندقية',
    description: 'مقيم بمكة والمدينة لمتابعة جودة الغرف والبوفيه المفتوح وتلبية كافة الطلبات الخاصة 24/7.',
    image: '/api/staff-image/team_member_08.png',
  },
];

export default function AboutSection() {
  return (
    <section id="about-section" className="w-full my-6 sm:my-10 px-3 sm:px-6 font-tajawal">
      {/* ── ELEGANT LIGHT GRAY CONTAINER (MATCHING PREVIOUS SECTIONS & PHOTO BACKGROUNDS) ── */}
      <div className="relative w-full rounded-2xl md:rounded-3xl bg-[#f8fafc] border border-slate-200 shadow-xl overflow-hidden py-10 sm:py-14 px-4 sm:px-8 md:px-12 text-slate-900">
        
        {/* ── TOP: ONLY TITLE & SMALL DESCRIPTION ── */}
        <div className="relative z-10 max-w-7xl mx-auto text-center space-y-3 mb-10 sm:mb-12">
          <h2 className="font-cairo text-2xl sm:text-3xl md:text-4xl font-black text-slate-900">
            طاقم الوكالة والمرشدون الميدانيون
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            نخبة من الإداريين والعلماء المرشدين لمرافقتك طوال مراحل رحلة العمرة والحج.
          </p>
        </div>

        {/* ── CARDS GRID (HIGH CONTRAST WHITE GLASS CONTAINER FOR 100% LEGIBILITY) ── */}
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEAM_MEMBERS.map((member) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="group relative rounded-2xl h-[440px] sm:h-[480px] w-full overflow-hidden shadow-md hover:shadow-xl border border-slate-200/90 transition-all duration-500 bg-slate-100 flex flex-col justify-end p-3.5 sm:p-4 text-right"
            >
              {/* FULL CARD BACKGROUND IMAGE (100% COVERAGE OF CARD) */}
              <img
                src={member.image}
                alt={member.name}
                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  const filename = member.image.split('/').pop();
                  if (filename && !e.currentTarget.src.includes('/api/staff-image/')) {
                    e.currentTarget.src = `/api/staff-image/${filename}`;
                  }
                }}
              />

              {/* OVERLAID CONTENT AT BOTTOM IN A HIGH-CONTRAST WHITE GLASS CONTAINER */}
              <div className="relative z-20 bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 border border-slate-200/90 shadow-xl space-y-2.5 text-right">
                <div className="space-y-0.5 font-tajawal">
                  <h3 className="font-cairo text-base sm:text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {member.name}
                  </h3>
                  <p className="text-xs font-bold text-emerald-700 font-cairo">
                    {member.role}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {member.description}
                  </p>
                </div>

                {/* CONNECT BUTTON */}
                <div className="pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => alert(`يمكنك التواصل مع ${member.name} عبر بوابة الوكالة أثناء السفر.`)}
                    className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 font-tajawal"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    تواصل
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
