'use client';

import React, { useState } from 'react';
import { StarRating } from '@/components/StarRating';

export default function ReviewComposer({
  targetType = 'agency',
  targetId = 'main',
  targetName = 'وكالة ساوث ستريت',
  defaultName = '',
  compact = false,
  onSubmitted,
}: {
  targetType?: 'agency' | 'staff' | 'package';
  targetId?: string;
  targetName?: string;
  defaultName?: string;
  compact?: boolean;
  onSubmitted?: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : '';
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetType,
          targetId,
          targetName,
          reviewerName: name,
          stars,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر إرسال التقييم');
        return;
      }
      setBody('');
      setMsg(data.message || 'تم إرسال تقييمك للمراجعة');
      onSubmitted?.();
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`review-composer ${compact ? 'is-compact' : ''}`} dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-800">{compact ? 'تقييم' : `اكتب تقييمك لـ ${targetName}`}</p>
        <StarRating value={stars} onChange={setStars} />
      </div>
      {compact ? (
        <input type="hidden" value={name} readOnly />
      ) : (
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسمك الكريم"
        className="luxury-form-input text-sm"
      />
      )}
      <textarea
        required
        rows={compact ? 3 : 4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="رأيك باختصار"
        className="luxury-form-input record-big-textarea text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {msg && <p className="text-xs text-emerald-700 font-bold">{msg}</p>}
      <button type="submit" disabled={busy} className="btn-pro-primary text-xs py-2.5 px-4 self-start disabled:opacity-50">
        {busy ? '...' : compact ? 'إرسال' : 'إرسال للتقييم — يظهر بعد موافقة الإدارة'}
      </button>
    </form>
  );
}
