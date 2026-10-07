'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Film, Link2, Loader2, Trash2 } from 'lucide-react';
import { extractImageUrls, serializeImageList } from '@/lib/table-cell-utils';
import { normalizeVideoLink, videoEmbedUrl } from '@/lib/video-url';

const MAX_VIDEO = 80 * 1024 * 1024;

function uploadErrorMessage(raw: string) {
  if (/Failed to parse body as FormData/i.test(raw)) {
    return 'تعذر قراءة الفيديو. اختر ملفاً أصغر من 80 ميغابايت بصيغة MP4.';
  }
  return raw || 'تعذر رفع الفيديو';
}

async function uploadVideoFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(uploadErrorMessage(String(data.error || '')));
  return data.url as string;
}

export default function HotelVideosField({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollTopRef = useRef(0);
  const pickingRef = useRef(false);
  const items = extractImageUrls(value, 'videos');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  const commit = (next: string[]) => onChange?.(serializeImageList(next));

  const rememberScroll = () => {
    const scroller = inputRef.current?.closest('.record-big-body') as HTMLElement | null;
    scrollTopRef.current = scroller?.scrollTop ?? 0;
    pickingRef.current = true;
  };

  const restoreScroll = () => {
    if (!pickingRef.current) return;
    const scroller = inputRef.current?.closest('.record-big-body') as HTMLElement | null;
    if (!scroller) return;
    scroller.scrollTop = scrollTopRef.current;
  };

  useEffect(() => {
    const onFocus = () => {
      restoreScroll();
      pickingRef.current = false;
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const addLink = () => {
    const url = normalizeVideoLink(link);
    if (!url) {
      setError('الصق رابط فيديو يبدأ بـ https://');
      return;
    }
    if (items.includes(url)) {
      setError('هذا الرابط مضاف مسبقاً.');
      return;
    }
    setError('');
    commit([...items, url]);
    setLink('');
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > MAX_VIDEO) {
      setError('حجم الفيديو يتجاوز 80 ميغابايت. اختر مقطعاً أقصر.');
      if (inputRef.current) inputRef.current.value = '';
      restoreScroll();
      return;
    }
    setBusy(true);
    try {
      const url = await uploadVideoFile(file);
      commit([...items, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الفيديو');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    }
  };

  return (
    <div className="hotel-videos">
      {items.length === 0 ? <p className="hotel-videos-empty">لا فيديو بعد</p> : null}
      <div className="hotel-videos-list">
        {items.map((url, index) => (
          <article key={`${url}-${index}`} className="hotel-video-tile">
            {videoEmbedUrl(url) ? (
              <iframe title="فيديو الفندق" src={videoEmbedUrl(url) || undefined} className="hotel-video-embed" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            ) : (
              <video src={url} controls preload="metadata" />
            )}
            {!readOnly ? (
              <button type="button" className="hotel-video-remove" onClick={() => commit(items.filter((_, i) => i !== index))} aria-label="حذف الفيديو">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {!readOnly ? (
        <div className="hotel-video-actions">
          <label className={`hotel-video-add ${busy ? 'is-busy' : ''}`} onPointerDown={rememberScroll}>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hotel-video-file"
              disabled={busy}
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
            <span>{busy ? 'جاري الرفع…' : 'رفع فيديو'}</span>
          </label>
          <div className="hotel-video-url">
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder="أو الصق رابط فيديو / يوتيوب"
              className="luxury-form-input"
              dir="ltr"
              disabled={busy}
            />
            <button type="button" onClick={addLink} disabled={busy || !link.trim()}>
              <Link2 className="w-4 h-4" /> إضافة الرابط
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="record-gallery-error">{error}</p> : null}
    </div>
  );
}
