'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Heart, SearchX, Search, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import Footer from '@/components/Footer';
import ProgramRow from '@/components/ProgramRow';
import { Package } from '@/types';
import { readWishlist } from '@/lib/wishlist';
import { parseTripDate } from '@/lib/booking-catalog';
import {
  PROGRAM_TYPE_LABEL,
  formatProgramDate,
  isBookable,
  programAvailability,
  programMinPrice,
} from '@/lib/program-display';

type SortKey = 'date' | 'price-asc' | 'price-desc';

function startTime(pkg: Package): number {
  return parseTripDate(pkg.start_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function PackagesPageInner() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [season, setSeason] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('date');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/admin/packages')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data)) setPackages(data);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
    const sync = () => setSaved(readWishlist());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('southstreet:wishlist-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('southstreet:wishlist-updated', sync);
    };
  }, []);

  // Deep links from the home page: /packages#<package_id>
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const archive = el.closest('details');
    if (archive) (archive as HTMLDetailsElement).open = true;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('is-target');
  }, [loading, packages]);

  // Filters offer only what the catalog actually contains (deduped by visible label).
  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    packages
      .filter((p) => programAvailability(p) !== 'expired')
      .forEach((p) => {
        if (p.type && !seen.has(p.type)) seen.set(p.type, PROGRAM_TYPE_LABEL[p.type] || p.type);
      });
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [packages]);
  const seasonOptions = useMemo(() => {
    const map = new Map<string, string>();
    packages.forEach((p) => {
      if (p.season_id) map.set(p.season_id, p.season_name || p.season_id);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [packages]);

  const upcomingAll = useMemo(
    () => packages.filter((p) => programAvailability(p) !== 'expired').sort((a, b) => startTime(a) - startTime(b)),
    [packages]
  );
  const summary = useMemo(() => {
    const bookable = upcomingAll.filter((p) => isBookable(programAvailability(p)));
    const prices = bookable.map(programMinPrice).filter((n) => n > 0);
    return {
      count: bookable.length,
      next: bookable[0] ? formatProgramDate(bookable[0].start_date, false) : '',
      from: prices.length ? Math.min(...prices) : 0,
    };
  }, [upcomingAll]);

  const { active, expired } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = packages.filter((pkg) => {
      if (type !== 'ALL' && pkg.type !== type) return false;
      if (season !== 'ALL' && pkg.season_id !== season) return false;
      if (onlySaved && !saved.includes(pkg.package_id)) return false;
      if (q) {
        const hay = [pkg.name, pkg.makkah_hotel_name, pkg.madinah_hotel_name, pkg.airline, pkg.departure_city, pkg.season_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorter = (a: Package, b: Package) => {
      if (sort === 'price-asc') return (programMinPrice(a) || Infinity) - (programMinPrice(b) || Infinity);
      if (sort === 'price-desc') return programMinPrice(b) - programMinPrice(a);
      return startTime(a) - startTime(b);
    };
    const live = matches
      .filter((p) => programAvailability(p) !== 'expired')
      .filter((p) => !onlyOpen || isBookable(programAvailability(p)))
      .sort(sorter);
    const past = matches
      .filter((p) => programAvailability(p) === 'expired')
      .sort((a, b) => startTime(b) - startTime(a));
    return { active: live, expired: past };
  }, [packages, query, type, season, sort, onlyOpen, onlySaved, saved]);

  const filtersOn = type !== 'ALL' || season !== 'ALL' || onlyOpen || onlySaved || query.trim() !== '';
  const resetFilters = () => {
    setQuery('');
    setType('ALL');
    setSeason('ALL');
    setOnlyOpen(false);
    setOnlySaved(false);
  };

  return (
    <div className="page-shell catalog-page min-h-screen">
      <Navbar variant="light" />

      <main className="page-main pb-20 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="pcat-head">
          <div>
            <p className="pcat-eyebrow">البرامج</p>
            <h1>برامج العمرة والحج</h1>
            <p className="pcat-lead">اختر موعد رحلتك وقارن الفنادق والأسعار، ثم أرسل طلبك وتؤكده الوكالة.</p>
          </div>
          {!loading && summary.count > 0 ? (
            <dl className="pcat-stats">
              <div><dt>برامج متاحة</dt><dd>{summary.count}</dd></div>
              {summary.next ? <div><dt>أقرب انطلاق</dt><dd>{summary.next}</dd></div> : null}
              {summary.from ? <div><dt>ابتداءً من</dt><dd>{summary.from.toLocaleString('ar-DZ')} <small>دج</small></dd></div> : null}
            </dl>
          ) : null}
        </header>

        <div className="pcat-bar" role="search">
          <div className="pcat-bar-top">
            <label className="pcat-search">
              <Search className="w-4 h-4" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن برنامج، فندق، أو طيران"
                aria-label="بحث في البرامج"
                maxLength={80}
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث" className="pcat-clear">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </label>
            <label className="pcat-select">
              <span className="sr-only">الترتيب</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="date">الأقرب موعداً</option>
                <option value="price-asc">الأقل سعراً</option>
                <option value="price-desc">الأعلى سعراً</option>
              </select>
              <ChevronDown className="w-4 h-4" aria-hidden />
            </label>
          </div>

          <div className="pcat-bar-bottom">
            {typeOptions.length > 1 ? (
              <div className="pcat-seg" role="group" aria-label="نوع البرنامج">
                <button type="button" aria-pressed={type === 'ALL'} onClick={() => setType('ALL')}>الكل</button>
                {typeOptions.map((t) => (
                  <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="pcat-extras">
              {seasonOptions.length > 1 ? (
                <label className="pcat-select is-small">
                  <span className="sr-only">الموسم</span>
                  <select value={season} onChange={(e) => setSeason(e.target.value)}>
                    <option value="ALL">كل المواسم</option>
                    {seasonOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4" aria-hidden />
                </label>
              ) : null}
              {saved.length ? (
                <button type="button" className="pcat-pill" aria-pressed={onlySaved} onClick={() => setOnlySaved((v) => !v)}>
                  <Heart className="w-3.5 h-3.5" aria-hidden fill={onlySaved ? 'currentColor' : 'none'} />
                  المفضلة {saved.length}
                </button>
              ) : null}
              <label className="pcat-switch">
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                <span className="pcat-switch-track" aria-hidden><i /></span>
                المتاح للحجز فقط
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="pcat-list" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="prow is-skeleton" />)}
          </div>
        ) : failed ? (
          <div className="pcat-empty">
            <SearchX className="w-8 h-8" aria-hidden />
            <strong>تعذّر تحميل البرامج</strong>
            <p>أعد تحميل الصفحة بعد قليل.</p>
          </div>
        ) : (
          <>
            <div className="pcat-results" aria-live="polite">
              <span>{active.length ? `${active.length} برنامج قادم` : 'لا نتائج'}</span>
              {filtersOn ? (
                <button type="button" onClick={resetFilters}>مسح الفلاتر</button>
              ) : null}
            </div>

            {active.length === 0 ? (
              <div className="pcat-empty">
                <SearchX className="w-8 h-8" aria-hidden />
                <strong>لا توجد برامج قادمة مطابقة</strong>
                <p>جرّب نوعاً آخر أو امسح الفلاتر لرؤية كل المواعيد.</p>
                {filtersOn ? <button type="button" onClick={resetFilters}>عرض كل البرامج</button> : null}
              </div>
            ) : (
              <div className="pcat-list">
                {active.map((pkg, index) => (
                  <ProgramRow key={pkg.package_id} pkg={pkg} index={index} />
                ))}
              </div>
            )}

            {expired.length ? (
              <details className="pcat-archive">
                <summary>
                  البرامج المنتهية
                  <span>{expired.length}</span>
                  <ChevronDown className="w-4 h-4" aria-hidden />
                </summary>
                <div className="pcat-list">
                  {expired.map((pkg, index) => (
                    <ProgramRow key={pkg.package_id} pkg={pkg} index={index} compact />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}

        <p className="pcat-help">
          لم تجد الموعد المناسب؟ اتصل بالوكالة على{' '}
          <a href="tel:+21321554433" dir="ltr">+213 21 55 44 33</a> وسنقترح عليك أقرب برنامج.
        </p>
      </main>

      <Footer />
      <SakhrAgent />
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen page-shell flex items-center justify-center text-slate-500">جاري التحميل...</div>}>
      <PackagesPageInner />
    </Suspense>
  );
}
