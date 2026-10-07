'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Film, MapPin, Star, X } from 'lucide-react';
import type { Hotel } from '@/types';
import GoogleMapPinLink, { hasMapPoint } from '@/components/hotels/GoogleMapPinLink';
import { videoEmbedUrl } from '@/lib/video-url';

const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop';

function cityLabel(city: string) {
  return city === 'MAKKAH' ? 'مكة المكرمة' : city === 'MADINAH' ? 'المدينة المنورة' : city;
}

function categoryMark(category: string) {
  if (category === 'VIP') return 'VIP';
  const digit = String(category || '').match(/(\d)/);
  return digit ? digit[1] : '';
}

export default function HotelGalleryDialog({
  hotel,
  onClose,
}: {
  hotel: Hotel;
  onClose: () => void;
}) {
  const photos = (hotel.images || []).filter(Boolean);
  const clips = (hotel.videos || []).filter(Boolean);
  const frames = [
    ...(photos.length ? photos : [FALLBACK]).map((url) => ({ kind: 'image' as const, url })),
    ...clips.map((url) => ({ kind: 'video' as const, url })),
  ];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();
  const count = frames.length;
  const current = frames[Math.min(index, count - 1)];
  const showingVideo = current.kind === 'video';
  const embedUrl = showingVideo ? videoEmbedUrl(current.url) : null;
  const ease = [0.22, 1, 0.36, 1] as const;

  const step = useCallback((delta: number) => {
    setDir(delta);
    setIndex((i) => (i + delta + count) % count);
  }, [count]);

  const jump = (next: number) => {
    if (next === index) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLVideoElement) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') step(1);
      if (e.key === 'ArrowRight') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [count, onClose, step]);

  const mark = categoryMark(hotel.category);

  return (
    <motion.div
      className="hotel-detail font-tajawal"
      role="dialog"
      aria-modal="true"
      aria-label={hotel.name}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.01 : 0.28 }}
    >
      <button type="button" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" aria-label="إغلاق" onClick={onClose} />
      <motion.div
        className="hotel-detail-panel"
        initial={reduce ? false : { opacity: 0, y: 28, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: reduce ? 0.01 : 0.42, ease }}
      >
        <div className="hotel-detail-stage">
          <AnimatePresence initial={false} custom={dir}>
            {showingVideo && embedUrl ? (
              <motion.iframe
                key={`embed-${index}`}
                title="فيديو الفندق"
                src={embedUrl}
                className="hotel-detail-media bg-black"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                custom={dir}
                variants={slideVariants(reduce)}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0.01 : 0.45, ease }}
              />
            ) : showingVideo ? (
              <motion.video
                key={`video-${index}`}
                src={current.url}
                controls
                playsInline
                preload="metadata"
                className="hotel-detail-media bg-black object-contain"
                custom={dir}
                variants={slideVariants(reduce)}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0.01 : 0.45, ease }}
              />
            ) : (
              <motion.img
                key={`photo-${index}`}
                src={current.url}
                alt=""
                className="hotel-detail-media object-cover"
                custom={dir}
                variants={slideVariants(reduce)}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0.01 : 0.45, ease }}
              />
            )}
          </AnimatePresence>
          <button type="button" onClick={onClose} className="absolute left-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
          {index === 0 && !showingVideo ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow">
              <Star className="h-3.5 w-3.5 fill-current" /> الصورة الرئيسية
            </span>
          ) : null}
          {count > 1 ? (
            <>
              <button type="button" className="absolute right-3 top-1/2 z-[2] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow" aria-label="السابقة" onClick={() => step(-1)}>
                <ChevronRight className="h-5 w-5" />
              </button>
              <button type="button" className="absolute left-3 top-1/2 z-[2] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow" aria-label="التالية" onClick={() => step(1)}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              {showingVideo ? null : (
                <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-bold text-white" dir="ltr">
                  {index + 1} / {count}
                </span>
              )}
            </>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-4 sm:px-5">
          <div className="hotel-intro">
            <div className="hotel-intro-meta">
              <p className="hotel-intro-kicker">{cityLabel(hotel.city)}</p>
              {mark ? (
                <span className={`hotel-intro-rate${mark === 'VIP' ? ' is-vip' : ''}`}>
                  <Star />
                  {mark}
                </span>
              ) : null}
            </div>
            <div className="hotel-intro-head">
              <h2>{hotel.name}</h2>
              {hasMapPoint(hotel.latitude, hotel.longitude) ? (
                <GoogleMapPinLink latitude={Number(hotel.latitude)} longitude={Number(hotel.longitude)} />
              ) : null}
            </div>
            {hotel.distance_from_haram ? (
              <p className="hotel-intro-place">
                <MapPin className="h-3.5 w-3.5" /> {hotel.distance_from_haram}
              </p>
            ) : null}
            {hotel.description ? <p className="hotel-intro-text">{hotel.description}</p> : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {frames.map((frame, i) => (
              <button
                key={`${frame.url}-${i}`}
                type="button"
                onClick={() => jump(i)}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 ${i === index ? 'border-slate-900' : 'border-transparent'} ${i === 0 && frame.kind === 'image' ? 'ring-2 ring-emerald-500' : ''}`}
                aria-label={frame.kind === 'video' ? 'فيديو الفندق' : i === 0 ? 'الصورة الرئيسية' : `الصورة ${i + 1}`}
                aria-current={i === index}
              >
                {frame.kind === 'video' ? (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900 text-white">
                    <Film className="h-4 w-4" />
                    <span className="text-[9px] font-black">فيديو</span>
                  </span>
                ) : (
                  <img src={frame.url} alt="" className="h-full w-full object-cover" />
                )}
                {i === 0 && frame.kind === 'image' ? <span className="absolute bottom-1 right-1 rounded bg-emerald-600 px-1 text-[9px] font-black text-white">رئيسية</span> : null}
              </button>
            ))}
          </div>
          {hotel.services?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hotel.services.map((s) => (
                <span key={s} className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{s}</span>
              ))}
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

function slideVariants(reduce: boolean | null) {
  const shift = reduce ? 0 : 72;
  return {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? -shift : shift }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? shift : -shift }),
  };
}
