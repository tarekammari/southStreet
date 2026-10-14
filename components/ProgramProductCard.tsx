'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock, Hotel, MapPin, Plane, UserRound } from 'lucide-react';
import type { Package } from '@/types';
import { DEPOSIT_PERCENT, ROOM_LABELS, parseTripDate } from '@/lib/booking-catalog';
import { publicList } from '@/lib/public-catalog';
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

type Guide = { morshid_id: string; name: string; image?: string; avatar?: string };

/** Guides come from the shared public catalogue (one request for the whole page). */
let guidesPromise: Promise<Guide[]> | null = null;
function useGuide(id?: string): Guide | null {
  const [guide, setGuide] = useState<Guide | null>(null);
  useEffect(() => {
    if (!id) return;
    guidesPromise ||= publicList<Guide>('staff');
    let live = true;
    guidesPromise.then((list) => live && setGuide(list.find((g) => g.morshid_id === id) || null));
    return () => { live = false; };
  }, [id]);
  return guide;
}

const AIRLINE_LOGOS: [RegExp, string][] = [[/alg[eé]rie|algeria|الجزائري/i, '/images/AIR_ALGERIA.webp']];
const airlineLogo = (name: string) => AIRLINE_LOGOS.find(([re]) => re.test(name))?.[1] || '';

function cheapestRoom(pkg: Package): string {
  const priced = (pkg.prices || []).filter((p) => Number(p.amount) > 0);
  if (!priced.length) return '';
  const min = priced.reduce((a, b) => (Number(b.amount) < Number(a.amount) ? b : a));
  return ROOM_LABELS[min.room_type] || '';
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
}

/** Catalogue product card: photo with the trip date, then hotels, guide and flight, then price & booking. */
export default function ProgramProductCard({ pkg, index }: { pkg: Package; index: number }) {
  const availability = programAvailability(pkg);
  const bookable = isBookable(availability);
  const price = programMinPrice(pkg);
  const fill = seatFillPercent(pkg);
  const room = cheapestRoom(pkg);
  const guide = useGuide(pkg.morshid_id);
  const guidePhoto = guide?.image || guide?.avatar || '';
  const logo = pkg.airline ? airlineLogo(pkg.airline) : '';
  const showSeats = pkg.capacity > 0 && (availability === 'open' || availability === 'few' || availability === 'full');

  const start = formatProgramDate(pkg.start_date, false);
  const end = formatProgramDate(pkg.end_date);
  const validStart = parseTripDate(pkg.start_date);

  return (
    <article id={pkg.package_id} className={`pcard is-${availability}`}>
      <div className="pcard-media">
        <img
          src={programImage(pkg, index)}
          alt={pkg.name}
          loading={index < 3 ? 'eager' : 'lazy'}
          onError={(e) => {
            const next = PROGRAM_FALLBACK_IMAGES[(index + 1) % PROGRAM_FALLBACK_IMAGES.length];
            if (!e.currentTarget.src.endsWith(next)) e.currentTarget.src = next;
          }}
        />
        <div className="pcard-top">
          <span className="pcard-type">{PROGRAM_TYPE_LABEL[pkg.type] || pkg.type}</span>
          {availability !== 'open' ? <span className={`pcard-status is-${availability}`}>{AVAILABILITY_LABEL[availability]}</span> : null}
          <span className="pcard-heart"><WishlistHeart packageId={pkg.package_id} /></span>
        </div>

        {/* The departure date, emphasised like a calendar tile. */}
        {validStart ? (
          <div className="pcard-date" aria-label={`تاريخ الانطلاق ${start}`}>
            <b>{validStart.toLocaleDateString('ar-DZ', { day: 'numeric' })}</b>
            <span>{validStart.toLocaleDateString('ar-DZ', { month: 'short' })}</span>
          </div>
        ) : null}

        <div className="pcard-shade">
          <h2>{pkg.name}</h2>
          <p>
            <CalendarDays size={15} aria-hidden />
            {start && end ? `${start} — ${end}` : start || 'التاريخ يُعلن قريباً'}
            {pkg.duration_days ? <span className="pcard-days"><Clock size={13} aria-hidden /> {pkg.duration_days} يوماً</span> : null}
          </p>
        </div>
      </div>

      <div className="pcard-body">
        <ul className="pcard-facts">
          {pkg.makkah_hotel_name ? (
            <li>
              <span className="pcard-ico is-hotel"><Hotel aria-hidden /></span>
              <div>
                <small>فندق مكة المكرمة</small>
                <b>{pkg.makkah_hotel_name}</b>
                {pkg.makkah_hotel_dist ? <em><MapPin size={11} aria-hidden /> {pkg.makkah_hotel_dist}</em> : null}
              </div>
            </li>
          ) : null}
          {pkg.madinah_hotel_name ? (
            <li>
              <span className="pcard-ico is-hotel"><Hotel aria-hidden /></span>
              <div>
                <small>فندق المدينة المنورة</small>
                <b>{pkg.madinah_hotel_name}</b>
                {pkg.madinah_hotel_dist ? <em><MapPin size={11} aria-hidden /> {pkg.madinah_hotel_dist}</em> : null}
              </div>
            </li>
          ) : null}
          {pkg.morshid_name ? (
            <li>
              {guidePhoto ? (
                <img className="pcard-ico is-photo" src={guidePhoto} alt="" loading="lazy" />
              ) : (
                <span className="pcard-ico is-guide">{initials(pkg.morshid_name) || <UserRound aria-hidden />}</span>
              )}
              <div>
                <small>المرشد المرافق</small>
                <b>{pkg.morshid_name}</b>
              </div>
            </li>
          ) : null}
          {pkg.airline || pkg.departure_city ? (
            <li>
              {logo ? (
                <img className="pcard-ico is-logo" src={logo} alt="" loading="lazy" />
              ) : (
                <span className="pcard-ico is-flight"><Plane aria-hidden /></span>
              )}
              <div>
                <small>الطيران</small>
                <b>{pkg.airline || 'رحلة مباشرة'}</b>
                {pkg.departure_city ? <em><Plane size={11} aria-hidden /> من {pkg.departure_city}</em> : null}
              </div>
            </li>
          ) : null}
        </ul>

        {showSeats ? (
          <div className="pcard-seats">
            <div>
              <span>{pkg.available > 0 ? `${pkg.available} مقعد متبقٍ` : 'لا مقاعد'}</span>
              <span>{fill}٪ محجوز</span>
            </div>
            <i role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-label="نسبة المقاعد المحجوزة">
              <s style={{ width: `${Math.max(fill, 4)}%` }} />
            </i>
          </div>
        ) : null}

        <div className="pcard-foot">
          <div className="pcard-price">
            {price > 0 ? (
              <>
                <small>ابتداءً من{room ? ` · ${room}` : ''}</small>
                <strong>{price.toLocaleString('ar-DZ')} <em>دج</em></strong>
              </>
            ) : (
              <strong className="is-ask">السعر عند الطلب</strong>
            )}
          </div>
          {bookable ? (
            <Link href={`/book?package=${encodeURIComponent(pkg.package_id)}`} className="pcard-cta">
              احجز الآن <ArrowLeft size={16} aria-hidden />
            </Link>
          ) : (
            <span className="pcard-cta is-off">
              {availability === 'full' ? 'المقاعد مكتملة' : 'يفتح الحجز قريباً'}
            </span>
          )}
        </div>
        {bookable ? <p className="pcard-hint">عربون {Math.round(DEPOSIT_PERCENT * 100)}٪ فقط بعد قبول الوكالة لطلبك</p> : null}
      </div>
    </article>
  );
}
