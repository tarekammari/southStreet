'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import Footer from '@/components/Footer';
import { Hotel } from '@/types';
import { ArrowLeft, MapPin, Star } from 'lucide-react';
import Link from 'next/link';
import HotelGalleryDialog from '@/components/hotels/HotelGalleryDialog';
import { publicList } from '@/lib/public-catalog';
import { HOTEL_COUNTRIES, hotelCityLabel, hotelCountryOf } from '@/lib/tour';
import HotelSearchBar from '@/components/hotels/HotelSearchBar';
import PopularDestinations from '@/components/hotels/PopularDestinations';

const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&auto=format&fit=crop';


function starMark(category: string) {
  if (category === 'VIP') return 'VIP';
  const digit = String(category || '').match(/(\d)/);
  return digit ? digit[1] : '';
}

type ClassFilter = 'ALL' | 'VIP' | 'ECONOMY';

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [openHotel, setOpenHotel] = useState<Hotel | null>(null);
  // Country first (السعودية, تركيا…), then its cities.
  const [country, setCountry] = useState('ALL');
  const [place, setPlace] = useState('ALL');
  const [tier, setTier] = useState<ClassFilter>('ALL');
  const reduce = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;

  useEffect(() => {
    publicList<Hotel>('hotels')
      .then(data => {
        if (Array.isArray(data)) setHotels(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const countries = HOTEL_COUNTRIES.map((c) => ({
    ...c,
    n: hotels.filter((h) => hotelCountryOf(h.city) === c.id).length,
  })).filter((c) => c.n > 0);
  const others = hotels.filter((h) => !hotelCountryOf(h.city)).length;
  const inCountry = hotels.filter((h) => country === 'ALL' || (hotelCountryOf(h.city) || 'OTHER') === country);
  const cities = [...new Set(inCountry.map((h) => h.city))];

  const visible = inCountry.filter((htl) => {
    if (place !== 'ALL' && htl.city !== place) return false;
    if (tier === 'VIP' && htl.category !== 'VIP') return false;
    if (tier === 'ECONOMY' && String(htl.category) !== 'ECONOMY') return false;
    return true;
  });

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />

      <main className="page-main pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <section className="hhero" aria-labelledby="hhero-title">
          <h1 id="hhero-title">احجز فندقك بسهولة</h1>
          <p>ابحث بالبلد أو المدينة أو اسم الفندق، قارن الغرف والأسعار للإقامة كاملة بالدينار، وأرسل طلبك — تؤكده الوكالة مع الفندق.</p>
          <HotelSearchBar />
        </section>
        <PopularDestinations hotels={hotels} />
        <h2 className="hotel-page-title">
          {country === 'SA' ? 'فنادق الحرمين الشريفين' : country === 'ALL' ? 'فنادقنا في الحرمين وحول العالم' : `فنادق ${countries.find((c) => c.id === country)?.label || ''}`}
        </h2>
        {countries.length + (others ? 1 : 0) > 1 ? (
          <div className="hotel-countries" role="tablist" aria-label="البلد">
            <button type="button" role="tab" aria-selected={country === 'ALL'} onClick={() => { setCountry('ALL'); setPlace('ALL'); }}>
              كل البلدان <span>{hotels.length}</span>
            </button>
            {countries.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={country === c.id} onClick={() => { setCountry(c.id); setPlace('ALL'); }}>
                <i style={{ background: c.color }} aria-hidden /> {c.label} <span>{c.n}</span>
              </button>
            ))}
            {others ? (
              <button type="button" role="tab" aria-selected={country === 'OTHER'} onClick={() => { setCountry('OTHER'); setPlace('ALL'); }}>
                بلدان أخرى <span>{others}</span>
              </button>
            ) : null}
          </div>
        ) : null}
        <section className="hotel-stage">
          <div className="hotel-filter-row">
            <div className="hotel-filter-side is-places" role="group" aria-label="المدينة">
              {(cities.length > 1 ? ['ALL', ...cities] : ['ALL']).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`hotel-filter-btn${place === id ? ' is-on' : ''}`}
                  aria-pressed={place === id}
                  onClick={() => setPlace(id)}
                >
                  {id === 'ALL' ? 'كل المدن' : hotelCityLabel(id)}
                </button>
              ))}
            </div>
            <div className="hotel-filter-side is-class" role="group" aria-label="الفئة">
              {([
                ['ALL', 'الكل'],
                ['VIP', 'VIP'],
                ['ECONOMY', 'اقتصادي'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`hotel-filter-btn${tier === id ? ' is-on' : ''}`}
                  aria-pressed={tier === id}
                  onClick={() => setTier(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="hotel-stage-main">
            {loading ? (
              <div className="text-center py-20 text-slate-500">جاري تحميل الفنادق...</div>
            ) : hotels.length === 0 ? (
              <div className="text-center py-20 text-slate-500">لا توجد فنادق مسجلة حالياً.</div>
            ) : visible.length === 0 ? (
              <p className="hotel-filter-empty">لا فنادق في هذا الاختيار.</p>
            ) : (
              <motion.div className="hotel-board" layout>
                <AnimatePresence mode="popLayout">
                {visible.map((htl) => {
                  const mark = starMark(htl.category);
                  return (
                    <motion.article
                      key={htl.hotel_id}
                      layout
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenHotel(htl)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpenHotel(htl);
                        }
                      }}
                      className="hotel-shot"
                      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                      transition={{ duration: reduce ? 0.01 : 0.4, ease }}
                    >
                      <img src={htl.images?.[0] || FALLBACK} alt={htl.name} />
                      <div className="hotel-shot-shade" />
                      <div className="hotel-shot-top">
                        <span className="hotel-shot-city">
                          {hotelCityLabel(htl.city)}
                          {country === 'ALL' && hotelCountryOf(htl.city) && hotelCountryOf(htl.city) !== 'SA'
                            ? ` · ${HOTEL_COUNTRIES.find((c) => c.id === hotelCountryOf(htl.city))?.label}`
                            : ''}
                        </span>
                        {mark ? (
                          <span className={`hotel-shot-rate${mark === 'VIP' ? ' is-vip' : ''}`}>
                            <Star />
                            {mark}
                          </span>
                        ) : null}
                      </div>
                      <div className="hotel-shot-foot">
                        <h3>{htl.name}</h3>
                        {htl.distance_from_haram ? (
                          <p className="hotel-shot-place">
                            <MapPin />
                            {htl.distance_from_haram}
                          </p>
                        ) : null}
                        {htl.services?.length > 0 ? (
                          <div className="hotel-shot-services">
                            {htl.services.slice(0, 3).map((s) => (
                              <span key={s}>{s}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </motion.article>
                  );
                })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>

        <AnimatePresence>
          {openHotel ? <HotelGalleryDialog key={openHotel.hotel_id} hotel={openHotel} onClose={() => setOpenHotel(null)} /> : null}
        </AnimatePresence>

        <div className="mt-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
          </Link>
        </div>
      </main>

      <Footer />
      <SakhrAgent />
    </div>
  );
}
