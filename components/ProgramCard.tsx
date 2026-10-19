'use client';

import Link from 'next/link';
import type { Package } from '@/types';
import {
  AVAILABILITY_LABEL,
  PROGRAM_FALLBACK_IMAGES,
  formatProgramDate,
  isBookable,
  programAvailability,
  programImage,
  programMinPrice,
} from '@/lib/program-display';
import { Plane } from 'lucide-react';
import { destinationOf, isTourism, parseTour } from '@/lib/tour';

/** Home-page program card: photo, name, date, price, one action. Details live on /packages. */
export default function ProgramCard({ pkg, index }: { pkg: Package; index: number }) {
  const availability = programAvailability(pkg);
  const bookable = isBookable(availability);
  const price = programMinPrice(pkg);
  const date = formatProgramDate(pkg.start_date);
  const tourism = isTourism(pkg);
  const tour = tourism ? parseTour(pkg.tour) : null;
  const dest = tour ? destinationOf(tour.country) : null;
  const ownPhoto = Boolean(pkg.image_url) && !/kaaba|maka0/i.test(String(pkg.image_url));
  const href = bookable
    ? `/book?package=${encodeURIComponent(pkg.package_id)}`
    : `${tourism ? '/trips' : '/packages'}#${encodeURIComponent(pkg.package_id)}`;

  return (
    <Link href={href} className={`prog-card is-${availability}${tourism ? ' is-tour' : ''}`}>
      <div className="prog-media">
        {tourism && !ownPhoto ? (
          <div className={`pcard-tourcover is-${(dest?.id || 'xx').toLowerCase()}`} aria-hidden>
            <span><Plane aria-hidden /></span>
            <b>{dest?.label || tour?.country || 'رحلة سياحية'}</b>
          </div>
        ) : (
        <img
          src={programImage(pkg, index)}
          alt=""
          loading="lazy"
          onError={(e) => {
            const next = PROGRAM_FALLBACK_IMAGES[(index + 1) % PROGRAM_FALLBACK_IMAGES.length];
            if (!e.currentTarget.src.endsWith(next)) e.currentTarget.src = next;
          }}
        />
        )}
        {/* Only flag what changes the decision; "available" is the default. */}
        {availability !== 'open' ? (
          <span className={`prog-status is-${availability}`}>{AVAILABILITY_LABEL[availability]}</span>
        ) : null}
      </div>
      <div className="prog-body">
        <h3>{pkg.name}</h3>
        {tour && (dest || tour.country) ? (
          <p className="prog-where">{dest?.label || tour.country}{tour.cities.length ? ` · ${tour.cities.slice(0, 3).join('، ')}` : ''}</p>
        ) : null}
        <p className="prog-when">
          {date || 'قريباً'}
          {pkg.duration_days ? <span> · {pkg.duration_days} يوماً</span> : null}
        </p>
      </div>
      <div className="prog-foot">
        <strong className="prog-price">
          {price > 0 ? (
            <>
              {price.toLocaleString('ar-DZ')} <em>دج</em>
            </>
          ) : (
            <em>السعر عند الطلب</em>
          )}
        </strong>
        <span className={`prog-book${bookable ? '' : ' is-ghost'}`}>{bookable ? 'احجز' : 'التفاصيل'}</span>
      </div>
    </Link>
  );
}
