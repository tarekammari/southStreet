'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock, Hotel, Plane, UserRound } from 'lucide-react';
import type { Package } from '@/types';
import { DEPOSIT_PERCENT, ROOM_LABELS } from '@/lib/booking-catalog';
import {
  AVAILABILITY_LABEL,
  PROGRAM_FALLBACK_IMAGES,
  PROGRAM_TYPE_LABEL,
  formatProgramDate,
  isBookable,
  programAvailability,
  programImage,
  programMinPrice,
  seatFillPercent,
} from '@/lib/program-display';
import WishlistHeart from '@/components/WishlistHeart';

function cheapestRoom(pkg: Package): string {
  const priced = (pkg.prices || []).filter((p) => Number(p.amount) > 0);
  if (!priced.length) return '';
  const min = priced.reduce((a, b) => (Number(b.amount) < Number(a.amount) ? b : a));
  return ROOM_LABELS[min.room_type] || '';
}

function dateRange(pkg: Package): string {
  const from = formatProgramDate(pkg.start_date, false);
  const to = formatProgramDate(pkg.end_date);
  if (from && to) return `${from} — ${to}`;
  return formatProgramDate(pkg.start_date) || 'التاريخ يُعلن قريباً';
}

/** Catalog row: photo · trip facts · price & booking. Stacks on small screens. */
export default function ProgramRow({ pkg, index, compact = false }: { pkg: Package; index: number; compact?: boolean }) {
  const availability = programAvailability(pkg);
  const bookable = isBookable(availability);
  const price = programMinPrice(pkg);
  const fill = seatFillPercent(pkg);
  const room = cheapestRoom(pkg);
  const showSeats = pkg.capacity > 0 && (availability === 'open' || availability === 'few' || availability === 'full');
  const flight = [pkg.airline, pkg.departure_city].filter(Boolean).join(' · ');

  return (
    <article id={pkg.package_id} className={`prow is-${availability}${compact ? ' is-compact' : ''}`}>
      <div className="prow-media">
        <img
          src={programImage(pkg, index)}
          alt=""
          loading={index < 2 ? 'eager' : 'lazy'}
          onError={(e) => {
            const next = PROGRAM_FALLBACK_IMAGES[(index + 1) % PROGRAM_FALLBACK_IMAGES.length];
            if (!e.currentTarget.src.endsWith(next)) e.currentTarget.src = next;
          }}
        />
        <span className={`prow-status is-${availability}`}>{AVAILABILITY_LABEL[availability]}</span>
        {!compact && availability !== 'expired' ? (
          <span className="prow-heart"><WishlistHeart packageId={pkg.package_id} /></span>
        ) : null}
      </div>

      <div className="prow-body">
        <div className="prow-tags">
          <span>{PROGRAM_TYPE_LABEL[pkg.type] || pkg.type}</span>
          {pkg.duration_days ? <span><Clock className="w-3 h-3" aria-hidden /> {pkg.duration_days} يوماً</span> : null}
          {pkg.season_name ? <span>{pkg.season_name}</span> : null}
        </div>
        <h2 className="prow-title">{pkg.name}</h2>
        <p className="prow-dates">
          <CalendarDays className="w-4 h-4" aria-hidden />
          {dateRange(pkg)}
        </p>
        {!compact ? (
          <dl className="prow-facts">
            {pkg.makkah_hotel_name ? (
              <div>
                <dt><Hotel className="w-3.5 h-3.5" aria-hidden /> مكة المكرمة</dt>
                <dd>{pkg.makkah_hotel_name}</dd>
              </div>
            ) : null}
            {pkg.madinah_hotel_name ? (
              <div>
                <dt><Hotel className="w-3.5 h-3.5" aria-hidden /> المدينة المنورة</dt>
                <dd>{pkg.madinah_hotel_name}</dd>
              </div>
            ) : null}
            {flight ? (
              <div>
                <dt><Plane className="w-3.5 h-3.5" aria-hidden /> الطيران</dt>
                <dd>{flight}</dd>
              </div>
            ) : null}
            {pkg.morshid_name ? (
              <div>
                <dt><UserRound className="w-3.5 h-3.5" aria-hidden /> المرشد</dt>
                <dd>{pkg.morshid_name}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      <aside className="prow-aside">
        <div className="prow-price">
          {price > 0 ? (
            <>
              <span className="prow-price-label">ابتداءً من</span>
              <strong>{price.toLocaleString('ar-DZ')}<em> دج</em></strong>
              {room ? <span className="prow-price-note">للشخص · {room}</span> : null}
            </>
          ) : (
            <strong className="prow-price-ask">السعر عند الطلب</strong>
          )}
        </div>

        {showSeats ? (
          <div className="prow-seats">
            <div className="prow-seats-row">
              <span>{pkg.available > 0 ? `${pkg.available} مقعد متبقٍ` : 'لا مقاعد'}</span>
              <span>{pkg.capacity} إجمالاً</span>
            </div>
            <div className="prow-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-label="نسبة المقاعد المحجوزة">
              <i style={{ width: `${Math.max(fill, 4)}%` }} />
            </div>
          </div>
        ) : null}

        {bookable ? (
          <>
            <Link href={`/book?package=${encodeURIComponent(pkg.package_id)}`} className="prow-cta">
              احجز الآن
              <ArrowLeft className="w-4 h-4" aria-hidden />
            </Link>
            <p className="prow-hint">عربون {Math.round(DEPOSIT_PERCENT * 100)}٪ فقط بعد قبول الوكالة لطلبك</p>
          </>
        ) : (
          <span className="prow-cta is-off">
            {availability === 'expired' ? 'انتهى البرنامج' : availability === 'full' ? 'المقاعد مكتملة' : 'يفتح الحجز قريباً'}
          </span>
        )}
      </aside>
    </article>
  );
}
