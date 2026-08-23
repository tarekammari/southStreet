'use client';

import React, { useEffect, useState } from 'react';
import { Check, EyeOff, Star, MessageSquareReply, Pin } from 'lucide-react';
import { StarRating } from '@/components/StarRating';

interface ReviewRow {
  id: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reviewerName: string;
  stars: number;
  title: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  featured: boolean;
  adminReply: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار المراجعة',
  APPROVED: 'منشور',
  REJECTED: 'مرفوض',
  HIDDEN: 'مخفي',
};

export default function ReviewsModerator({
  staffId,
  title = 'تقييمات المعتمرين',
}: {
  staffId?: string;
  title?: string;
}) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [pending, setPending] = useState(0);
  const [filter, setFilter] = useState('');
  const [replyFor, setReplyFor] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/reviews${filter ? `?status=${filter}` : ''}`);
      const data = await res.json();
      let list: ReviewRow[] = data.reviews || [];
      if (staffId) list = list.filter((r) => r.targetType === 'staff' && r.targetId === staffId);
      setReviews(list);
      setPending(staffId ? list.filter((r) => r.status === 'PENDING').length : data.pending || 0);
    } catch {
      setError('تعذر تحميل التقييمات');
    }
  };

  useEffect(() => {
    load();
  }, [filter, staffId]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError('');
    const token = localStorage.getItem('south_street_token') || '';
    const res = await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'فشل التحديث');
      return;
    }
    setReplyFor('');
    setReply('');
    load();
  };

  return (
    <section className="reviews-moderator" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          {title}
          {pending > 0 && (
            <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
              {pending} بانتظارك
            </span>
          )}
        </h4>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="luxury-form-input text-xs py-1.5 px-2 w-auto"
        >
          <option value="">الكل</option>
          <option value="PENDING">بانتظار المراجعة</option>
          <option value="APPROVED">المنشور</option>
          <option value="HIDDEN">المخفي</option>
          <option value="REJECTED">المرفوض</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {reviews.length === 0 && (
        <p className="text-xs text-slate-500">لا توجد تقييمات في هذا التصنيف.</p>
      )}
      <div className="space-y-2.5">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{review.reviewerName}</p>
                <p className="text-[11px] text-slate-500">
                  {review.targetName || review.targetType} · {STATUS_LABEL[review.status]}
                </p>
              </div>
              <StarRating value={review.stars} readOnly size="sm" />
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{review.body}</p>
            {review.adminReply && (
              <p className="text-[11px] text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2">
                رد الإدارة: {review.adminReply}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {review.status !== 'APPROVED' && (
                <button type="button" className="btn-pro-primary text-[11px] py-1 px-2.5" onClick={() => patch(review.id, { status: 'APPROVED' })}>
                  <Check className="w-3 h-3" /> نشر
                </button>
              )}
              {review.status === 'APPROVED' && (
                <button type="button" className="btn-pro-outline text-[11px] py-1 px-2.5" onClick={() => patch(review.id, { status: 'HIDDEN' })}>
                  <EyeOff className="w-3 h-3" /> إخفاء
                </button>
              )}
              <button
                type="button"
                className="btn-pro-outline text-[11px] py-1 px-2.5"
                onClick={() => patch(review.id, { featured: !review.featured, status: review.status === 'PENDING' ? 'APPROVED' : review.status })}
              >
                <Pin className="w-3 h-3" /> {review.featured ? 'إلغاء التمييز' : 'تمييز'}
              </button>
              <button
                type="button"
                className="btn-pro-outline text-[11px] py-1 px-2.5"
                onClick={() => { setReplyFor(review.id); setReply(review.adminReply || ''); }}
              >
                <MessageSquareReply className="w-3 h-3" /> رد
              </button>
              {review.status !== 'REJECTED' && (
                <button type="button" className="text-[11px] text-red-600 px-2" onClick={() => patch(review.id, { status: 'REJECTED' })}>
                  رفض
                </button>
              )}
            </div>
            {replyFor === review.id && (
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="رد الإدارة العلني"
                  className="luxury-form-input text-xs flex-1"
                />
                <button type="button" className="btn-pro-primary text-[11px] py-1.5 px-3" onClick={() => patch(review.id, { adminReply: reply, status: review.status === 'PENDING' ? 'APPROVED' : review.status })}>
                  حفظ الرد
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
