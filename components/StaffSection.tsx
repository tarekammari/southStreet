'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Award, BookOpen, HeartHandshake, Users, ShieldCheck, Star, Sparkles, CheckCircle2, PhoneCall } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  category: string;
  description: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ElementType;
  highlights: string[];
}

const STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'director',
    name: 'الحاج طارق العماري',
    role: 'المدير العام لوكالة سوث ستريت',
    category: 'الإدارة العليا',
    description: 'خبرة تزيد عن 15 عاماً في تنظيم وإدارة رحلات الحج والعمرة الفاخرة، مع الإشراف المباشر على كافة عقود الفنادق والطيران بالجزائر والسعودية.',
    badge: 'المدير العام',
    badgeBg: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
    badgeText: 'إشراف قيادي مباشر',
    icon: Award,
    highlights: ['إشراف مباشر على إقامة المعتمرين', 'ضمان أعلى جودة خدمات الفنادق', 'متابعة ميدانية 24/7'],
  },
  {
    id: 'male-guide',
    name: 'الشيخ د. عبد القادر الجزائري',
    role: 'المستشار الشرعي والمرشد الديني (رجال)',
    category: 'الإرشاد الديني',
    description: 'متخصص في التوجيه الفقهي ومرافقة المعتمرين في مناسك الطواف والسعي والزيارات الشريفة بمكة والمدينة المنورة خطوة بخطوة.',
    badge: 'المرشد الشرعي (رجال)',
    badgeBg: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
    badgeText: 'توجيه فقهي وميداني',
    icon: BookOpen,
    highlights: ['إلقاء مجالس الفقه والدعاء', 'مرافقة ميدانية في صحن المطاف', 'شرح تفصيلي للمناسك والمزارات'],
  },
  {
    id: 'female-guide',
    name: 'الأستاذة خديجة المعتصم',
    role: 'المشرفة والحيية الشرعية (نساء)',
    category: 'الإرشاد النسوي',
    description: 'مخصصة لمرافقة المعتمرات وتوجيههن في الطواف والسعي وتسهيل تصاريح ودخول الروضة الشريفة بالمسجد النبوي بأمان ويسر.',
    badge: 'المرشدة الشرعية (نساء)',
    badgeBg: 'bg-purple-500/20 border-purple-400/40 text-purple-300',
    badgeText: 'إرشاد خاص بالنساء',
    icon: HeartHandshake,
    highlights: ['تصاريح دخول الروضة الشريفة', 'مرافقة خاصة للمعتمرات', 'إرشاد فقهي أحكام النساء'],
  },
  {
    id: 'logistics-team',
    name: 'فريق التنظيم والاستقبال الميداني',
    role: 'طاقم الحجوزات والتأشيرات والنقل',
    category: 'الدعم اللوجستي',
    description: 'فريق متكامل يعمل على مدار الساعة لاستخراج التأشيرات الفورية، حجز التذاكر المباشرة، واستقبال المعتمرين بالحافلات الفاخرة بالمطار.',
    badge: 'طاقم الخدمة والاستقبال',
    badgeBg: 'bg-blue-500/20 border-blue-400/40 text-blue-300',
    badgeText: 'خدمة 24/7',
    icon: Users,
    highlights: ['تأشيرات فورية وتذاكر طيران', 'استقبال بحافلات VIP مكيفة', 'دعم فني وتواصل مشفر E2E'],
  },
];

export default function StaffSection() {
  return (
    <section id="staff-section" className="w-full max-w-7xl mx-auto my-4 md:my-6 px-4 sm:px-6 font-tajawal relative z-10">
      
      {/* SECTION HEADER & AGENCY DESCRIPTION */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto space-y-4 mb-12 md:mb-16"
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 text-amber-300 border border-amber-400/30 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>كادر احترافي في خدمتكم طوال الرحلة</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-cairo text-white leading-tight">
          طاقم الإدارة والإرشاد الديني لوكالة سوث ستريت 🕋
        </h2>

        <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
          تتميز وكالة سوث ستريت بفريق عمل متميز يجمع بين الكفاءة الإدارية والإشراف الشرعي الميداني، حرصاً منا على توفير أعلى درجات الطمأنينة والتوجيه الفقهي الدقيق لجميع ضيوف الرحمن (رجال ونساء).
        </p>
      </motion.div>

      {/* STAFF & GUIDES CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {STAFF_MEMBERS.map((member, index) => {
          const IconComponent = member.icon;
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 hover:border-amber-400/40 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all hover:shadow-[0_15px_45px_-10px_rgba(0,0,0,0.7)] flex flex-col justify-between space-y-6 relative overflow-hidden group"
            >
              {/* Subtle Card Ambient Light */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/15 transition-colors" />

              <div className="space-y-4 relative z-10">
                {/* Top Badge & Category */}
                <div className="flex justify-between items-center gap-3">
                  <span className={`text-xs font-black px-3.5 py-1 rounded-full border shadow-sm ${member.badgeBg}`}>
                    {member.badge}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ● {member.category}
                  </span>
                </div>

                {/* Name & Role */}
                <div className="flex items-start gap-4 pt-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-white/15 flex items-center justify-center shrink-0 shadow-lg text-amber-400 group-hover:scale-105 transition-transform">
                    <IconComponent className="w-7 h-7" />
                  </div>

                  <div className="space-y-1 text-right">
                    <h3 className="text-xl font-black font-cairo text-white group-hover:text-amber-300 transition-colors">
                      {member.name}
                    </h3>
                    <p className="text-xs font-bold text-emerald-400 font-tajawal">
                      {member.role}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-right font-tajawal pt-1">
                  {member.description}
                </p>

                {/* Key Highlights */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {member.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-400 relative z-10">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{member.badgeText}</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">وكالة سوث ستريت المعتمدة</span>
              </div>

            </motion.div>
          );
        })}
      </div>

    </section>
  );
}
