'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, EyeOff, Loader2, MessageSquareReply, RefreshCw, Sparkles, Star, X } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';
import './reviews-moderation.css';

/**
 * Clients' testimonials, approved by the agency before they appear on the site
 * (like app-store reviews). Pending → publish or reject; published → hide, feature
 * on the home page, or answer publicly. API: /api/admin/reviews (managers).
 */

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
type Review = {
  id: string;
  targetType: 'agency' | 'staff' | 'package';
  targetName: string;
  reviewerName: string;
  stars: number;
  title: string;
  body: string;
  status: Status;
  featured: boolean;
  adminReply: string;
  createdAt: string;
};

const TABS: { id: 'PENDING' | 'APPROVED' | 'OTHER'; label: string }[] = [
  { id: 'PENDING', label: 'بانتظار الموافقة' },
  { id: 'APPROVED', label: 'منشورة' },
  { id: 'OTHER', label: 'مرفوضة / مخفية' },
];

const STATUS_LABEL: Record<Status, string> = { PENDING: 'بانتظار الموافقة', APPROVED: 'منشور', REJECTED: 'مرفوض', HIDDEN: 'مخفي' };
const TARGET_LABEL: Record<Review['targetType'], string> = { agency: 'الوكالة', staff: 'مرشد', package: 'برنامج' };

export const REVIEWS_UPDATED = 'southstreet:reviews-updated';

export default function ReviewsModeration() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'OTHER'>('PENDING');
  const [busy, setBusy] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reviews', { headers: authHeaders(), cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر تحميل التقييمات');
      setReviews(data.reviews || []);
    } catch (e) {
      setReviews([]);
      setToast((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const act = async (review: Review, patch: { status?: Status; featured?: boolean; adminReply?: string }, done: string) => {
    setBusy(review.id);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: review.id, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر التحديث');
      setReviews((list) => (list || []).map((r) => (r.id === review.id ? { ...r, ...data.review } : r)));
      setToast(done);
      window.dispatchEvent(new Event(REVIEWS_UPDATED));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const counts = {
    PENDING: (reviews || []).filter((r) => r.status === 'PENDING').length,
    APPROVED: (reviews || []).filter((r) => r.status === 'APPROVED').length,
    OTHER: (reviews || []).filter((r) => r.status === 'REJECTED' || r.status === 'HIDDEN').length,
  };
  const shown = (reviews || []).filter((r) => (tab === 'OTHER' ? r.status === 'REJECTED' || r.status === 'HIDDEN' : r.status === tab));
  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <section className="rvm" dir="rtl">
      <header className="rvm-head">
        <div>
          <h2><Star aria-hidden /> تقييمات المعتمرين</h2>
          <p>لا يظهر أي تقييم في الموقع قبل موافقة الوكالة. انشر الحقيقي منها، وميّز الأفضل ليظهر في الصفحة الرئيسية.</p>
        </div>
        <button type="button" className="rvm-refresh" onClick={() => { setReviews(null); void load(); }} aria-label="تحديث">
          <RefreshCw aria-hidden />
        </button>
      </header>

      <div className="rvm-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            <em className={t.id === 'PENDING' && counts.PENDING ? 'is-alert' : ''}>{counts[t.id]}</em>
          </button>
        ))}
      </div>

      {reviews === null ? (
        <p className="rvm-empty"><Loader2 className="animate-spin" aria-hidden /> جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <p className="rvm-empty">{tab === 'PENDING' ? 'لا توجد تقييمات بانتظار الموافقة.' : 'لا شيء هنا بعد.'}</p>
      ) : (
        <ul className="rvm-list">
          {shown.map((r) => (
            <li key={r.id} className={`rvm-card is-${r.status.toLowerCase()}`}>
              <div className="rvm-card-top">
                <span className="rvm-avatar">{(r.reviewerName || '؟').charAt(0)}</span>
                <div className="rvm-who">
                  <strong>{r.reviewerName || 'معتمر'}</strong>
                  <small>
                    {TARGET_LABEL[r.targetType]}
                    {r.targetType !== 'agency' && r.targetName ? `: ${r.targetName}` : ''} · {when(r.createdAt)}
                  </small>
                </div>
                <span className={`rvm-status is-${r.status.toLowerCase()}`}>{STATUS_LABEL[r.status]}</span>
              </div>

              <div className="rvm-stars" aria-label={`${r.stars} من 5`}>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= r.stars ? 'is-on' : ''} aria-hidden />)}
                {r.featured ? <span className="rvm-featured"><Sparkles aria-hidden /> مميّز في الرئيسية</span> : null}
              </div>
              {r.title ? <h3>{r.title}</h3> : null}
              <p className="rvm-body">{r.body}</p>

              {r.adminReply && replyFor !== r.id ? (
                <div className="rvm-reply"><b>ردّ الوكالة:</b> {r.adminReply}</div>
              ) : null}

              {replyFor === r.id ? (
                <div className="rvm-reply-edit">
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} maxLength={600} placeholder="ردّ قصير ومهذّب يظهر تحت التقييم…" />
                  <div>
                    <button type="button" className="rvm-btn is-primary" disabled={busy === r.id} onClick={() => void act(r, { adminReply: replyText.trim() }, 'تم حفظ الرد').then(() => setReplyFor(null))}>حفظ الرد</button>
                    <button type="button" className="rvm-btn" onClick={() => setReplyFor(null)}>إلغاء</button>
                  </div>
                </div>
              ) : null}

              <div className="rvm-actions">
                {r.status !== 'APPROVED' ? (
                  <button type="button" className="rvm-btn is-primary" disabled={busy === r.id} onClick={() => void act(r, { status: 'APPROVED' }, 'تم نشر التقييم في الموقع')}>
                    {busy === r.id ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} نشر
                  </button>
                ) : (
                  <>
                    <button type="button" className={`rvm-btn${r.featured ? ' is-on' : ''}`} disabled={busy === r.id} onClick={() => void act(r, { featured: !r.featured }, r.featured ? 'أُزيل من الرئيسية' : 'سيظهر في الصفحة الرئيسية')}>
                      <Sparkles aria-hidden /> {r.featured ? 'إلغاء التمييز' : 'تمييز في الرئيسية'}
                    </button>
                    <button type="button" className="rvm-btn" disabled={busy === r.id} onClick={() => void act(r, { status: 'HIDDEN', featured: false }, 'أُخفي التقييم من الموقع')}>
                      <EyeOff aria-hidden /> إخفاء
                    </button>
                  </>
                )}
                {r.status === 'PENDING' ? (
                  <button type="button" className="rvm-btn is-danger" disabled={busy === r.id} onClick={() => void act(r, { status: 'REJECTED', featured: false }, 'رُفض التقييم')}>
                    <X aria-hidden /> رفض
                  </button>
                ) : null}
                <button type="button" className="rvm-btn" onClick={() => { setReplyFor(r.id); setReplyText(r.adminReply || ''); }}>
                  <MessageSquareReply aria-hidden /> {r.adminReply ? 'تعديل الرد' : 'رد'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast ? <div className="rvm-toast" role="status">{toast}</div> : null}
    </section>
  );
}
