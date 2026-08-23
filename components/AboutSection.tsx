'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneCall } from 'lucide-react';
import { extractImageUrls } from '@/lib/table-cell-utils';
import { fetchJsonList } from '@/lib/fetch-json';
import { StarRating } from '@/components/StarRating';

interface MorshidRow {
  morshid_id: string;
  name: string;
  roleName?: string;
  specialization?: string;
  phone?: string;
  image?: string;
  avatar?: string;
  rating?: number;
  review_count?: number;
  reviewCount?: number;
}

function photoOf(member: MorshidRow): string {
  return extractImageUrls(member.image, 'image')[0] || extractImageUrls(member.avatar, 'avatar')[0] || '';
}

function initialOf(member: MorshidRow): string {
  const avatar = (member.avatar || '').trim();
  if (avatar.length > 0 && avatar.length <= 3 && !/[./]/.test(avatar)) return avatar;
  return (member.name || 'م').charAt(0);
}

export default function AboutSection() {
  const [members, setMembers] = useState<MorshidRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJsonList<MorshidRow>('/api/admin/morshids').then((data) => {
      if (cancelled) return;
      setMembers(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="about-section" className="w-full my-6 sm:my-10 px-3 sm:px-6 font-tajawal">
      <div className="relative w-full rounded-2xl md:rounded-3xl bg-[#f8fafc] border border-slate-200 shadow-xl overflow-hidden py-10 sm:py-14 px-4 sm:px-8 md:px-12 text-slate-900">
        <div className="relative z-10 max-w-7xl mx-auto text-center space-y-3 mb-10 sm:mb-12">
          <h2 className="font-cairo text-2xl sm:text-3xl md:text-4xl font-black text-slate-900">
            طاقم الوكالة والمرشدون الميدانيون
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            نخبة من الإداريين والعلماء المرشدين لمرافقتك طوال مراحل رحلة العمرة والحج.
          </p>
        </div>

        {loading ? (
          <div className="relative z-10 max-w-7xl mx-auto py-16 text-center text-sm text-slate-400">
            جاري تحميل الطاقم...
          </div>
        ) : members.length === 0 ? (
          <div className="relative z-10 max-w-7xl mx-auto py-16 text-center text-sm text-slate-400">
            لا يوجد أعضاء في جدول المرشدين حالياً.
          </div>
        ) : (
          <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => {
              const photo = photoOf(member);
              const phoneHref = member.phone ? `tel:${member.phone.replace(/\s+/g, '')}` : undefined;
              return (
                <motion.div
                  key={member.morshid_id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="group relative rounded-2xl h-[440px] sm:h-[480px] w-full overflow-hidden shadow-md hover:shadow-xl border border-slate-200/90 transition-all duration-500 bg-slate-100 flex flex-col justify-end p-3.5 sm:p-4 text-right"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={member.name}
                      className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 font-cairo text-6xl font-black text-emerald-700">
                      {initialOf(member)}
                    </div>
                  )}

                  <div className="relative z-20 bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 border border-slate-200/90 shadow-xl space-y-2.5 text-right">
                    <div className="space-y-0.5 font-tajawal">
                      <h3 className="font-cairo text-base sm:text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-xs font-bold text-emerald-700 font-cairo">
                        {member.roleName || ''}
                      </p>
                      {(Number(member.reviewCount || member.review_count) > 0 || Number(member.rating) > 0) && (
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <StarRating value={Number(member.rating) || 0} readOnly size="sm" showValue />
                          {Number(member.reviewCount || member.review_count) > 0 && (
                            <span className="text-[10px] text-slate-500">
                              ({member.reviewCount || member.review_count} تقييم)
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                        {member.specialization || ''}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80">
                      {phoneHref ? (
                        <a
                          href={phoneHref}
                          className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 font-tajawal"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          تواصل
                        </a>
                      ) : (
                        <span className="w-full py-2 px-4 rounded-xl bg-slate-100 text-slate-400 font-black text-xs flex items-center justify-center gap-2 font-tajawal">
                          تواصل
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
