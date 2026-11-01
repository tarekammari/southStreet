'use client';

import { useBrand } from '@/components/social/useAgencyInfo';
import { DEFAULT_BRAND } from '@/lib/brand';

/**
 * Brand lockup: the agency's mark + wordmark (name and tagline from
 * «هوية الوكالة»). With the default logo it is the three-stroke vector mark
 * (inline SVG: sharp at any size, strokes animate in on first paint); an agency
 * that uploaded its own logo or mark gets that image instead.
 */
export default function BrandLogo({
  tone = 'dark',
  compact = false,
  animate = true,
}: {
  tone?: 'dark' | 'light';
  compact?: boolean;
  animate?: boolean;
}) {
  const brand = useBrand();
  const ownMark = brand.mark_url !== DEFAULT_BRAND.mark_url ? brand.mark_url : brand.logo_url !== DEFAULT_BRAND.logo_url ? brand.logo_url : '';
  return (
    <span className={`brand${tone === 'light' ? ' is-light' : ''}${compact ? ' is-compact' : ''}${animate ? ' is-animated' : ''}`}>
      {ownMark ? (
        <img className="brand-mark brand-mark-img" src={ownMark} alt="" aria-hidden />
      ) : (
        <svg className="brand-mark" viewBox="0 0 700 410" aria-hidden focusable="false">
          <path className="brand-s3" d="M410 250 C 480 270 560 330 600 408 L 700 367 C 660 320 620 285 585 252 Z" />
          <path className="brand-s2" d="M0 154 C 120 146 260 146 330 152 L 696 154 L 696 252 L 0 252 Z" />
          <path className="brand-s1" d="M0 154 C 160 168 300 166 380 148 C 450 125 515 80 550 0 L 648 40 C 590 112 505 190 405 230 C 305 262 150 262 0 252 Z" />
        </svg>
      )}
      {!compact ? (
        <span className="brand-text">
          <span className="brand-name" lang="en">{brand.name_latin}</span>
          {brand.tagline ? <span className="brand-tag">{brand.tagline}</span> : null}
        </span>
      ) : null}
      <span className="sr-only">{brand.short_name} — الصفحة الرئيسية</span>
    </span>
  );
}
