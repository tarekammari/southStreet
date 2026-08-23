'use client';

import React, { useEffect, useState } from 'react';
import { StarRating } from '@/components/StarRating';
import ReviewComposer from '@/components/ReviewComposer';

interface ReviewItem {
  id: string;
  reviewerName: string;
  stars: number;
  body: string;
  targetName: string;
  featured: boolean;
  adminReply: string;
}

interface Summary {
  average: number;
  count: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

export default function TestimonialsSection() {
  const [summary, setSummary] = useState<Summary>({ average: 0, count: 0, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [openForm, setOpenForm] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/reviews?targetType=agency&targetId=main&limit=8');
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      setReviews(data.reviews || []);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const maxBar = Math.max(1, ...Object.values(summary.histogram));

  return (
    <section id="testimonials-section" className="w-full my-6 sm:my-10 px-3 sm:px-6 font-tajawal" dir="rtl">
      <div className="max-w-7xl mx-auto rounded-2xl md:rounded-3xl bg-white border border-slate-200 shadow-xl p-5 sm:p-8 md:p-10">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-72 shrink-0 space-y-3">
            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 inline-flex px-2.5 py-1 rounded-full">
              تقييمات المعتمرين المعتمدة
            </p>
            <h2 className="font-cairo text-2xl sm:text-3xl font-black text-slate-900">ماذا يقول ضيوف الرحمن؟</h2>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black font-cairo text-slate-900 leading-none">
                {summary.count ? summary.average.toFixed(1) : '—'}
              </span>
              <div className="pb-1 space-y-1">
                <StarRating value={summary.average} readOnly showValue={false} size="lg" />
                <p className="text-xs text-slate-500">{summary.count} تقييم منشور بعد مراجعة الإدارة</p>
              </div>
            </div>
            <div className="space-y-1.5 pt-2">
              {([5, 4, 3, 2, 1] as const).map((star) => (
                <div key={star} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="w-3 font-bold">{star}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(summary.histogram[star] / maxBar) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpenForm((v) => !v)}
              className="btn-pro-primary text-xs py-2.5 px-4"
            >
              {openForm ? 'إغلاق النموذج' : 'أضف تقييمك'}
            </button>
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            {openForm && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <ReviewComposer onSubmitted={load} />
              </div>
            )}

            {reviews.length === 0 && !openForm && (
              <p className="text-sm text-slate-500">لم تُنشر تقييمات بعد. كن أول من يكتب بعد انتهاء رحلته.</p>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{review.reviewerName}</p>
                    <StarRating value={review.stars} readOnly size="sm" />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{review.body}</p>
                  {review.adminReply && (
                    <p className="text-[11px] text-emerald-800 bg-white rounded-xl px-3 py-2 border border-emerald-100">
                      رد الوكالة: {review.adminReply}
                    </p>
                  )}
                  {review.featured && (
                    <span className="text-[10px] font-bold text-amber-700">مميّز من الإدارة</span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
