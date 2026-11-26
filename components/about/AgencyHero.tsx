'use client';

import React, { useEffect, useRef } from 'react';
import { CalligraphyRing, IslamicPattern, IslamicRosette } from '@/components/about/IslamicOrnament';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { agencyLabel } from '@/lib/brand';
import HeroShowcase from '@/components/about/HeroShowcase';
import { HeroOfferCopy } from '@/components/HeroSection';
import './agency-hero.css';

/**
 * The agency's calligraphy hero: the name in blue calligraphy, the logo crest
 * (rosettes, colour-changing petals, a floating logo that tilts toward the
 * pointer), an Islamic lattice and a turning ring of the Talbiyah.
 *
 * - layers="inside" (home page): the lattice and the ring belong to the hero,
 *   fixed to the screen and clipped to it, so the page slides over them.
 * - layers="page" (About page): the page renders <AgencyHeroLayers /> itself,
 *   so the lattice and ring stay behind / beside every section.
 */

/** Pointer position over the hero as --hx / --hy (-0.5 … 0.5), once per frame. */
let pointerFrame = 0;
function followPointer(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  const { clientX, clientY } = e;
  cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--hx', ((clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--hy', ((clientY - r.top) / r.height - 0.5).toFixed(3));
  });
}
function resetPointer(e: React.PointerEvent<HTMLElement>) {
  cancelAnimationFrame(pointerFrame);
  e.currentTarget.style.setProperty('--hx', '0');
  e.currentTarget.style.setProperty('--hy', '0');
}

/** Harakat for words that often appear in agency names (calligraphy looks bare without them). */
const TASHKEEL: Record<string, string> = {
  'وكالة': 'وَكَالَة',
  'رزاق': 'رَزَّاق',
  'هبلة': 'هَبْلَة',
  'للسياحة': 'لِلسِّيَاحَة',
  'والأسفار': 'وَالأَسْفَار',
  'السفر': 'السَّفَر',
};
/** The agency name without a trailing "تور". */
export const shortAgencyName = (name: string) => name.replace(/\s+(تور|تورز|tours?)$/i, '');
/** The agency name for the calligraphy line, with harakat where known. */
function calligraphyName(name: string): string {
  return shortAgencyName(name)
    .split(/\s+/)
    .map((w) => TASHKEEL[w] || w)
    .join(' ');
}

/** The lattice and the edge ring, for a page that shows them behind all its sections. */
export function AgencyHeroLayers() {
  return (
    <>
      <div className="gc-hero-pattern" aria-hidden><IslamicPattern /></div>
      <div className="gc-ring-wrap" aria-hidden>
        {/* The Kaaba in the middle of the turning ring (the photo itself stays still) */}
        <span className="gc-ring-kaaba"><img src="/images/kaaba_sharifa_home_page.webp" alt="" decoding="async" /></span>
        <CalligraphyRing className="gc-ring" />
      </div>
    </>
  );
}

export default function AgencyHero({
  layers = 'inside',
  title,
  showcase = false,
  offer = false,
  className = '',
}: {
  layers?: 'inside' | 'page';
  /** Under the crest: the main buttons and a strip of real numbers (programs, hotels, guides, rating). */
  showcase?: boolean;
  /** Under the crest: the open offer (or "no trips yet"), its buttons and the social links. */
  offer?: boolean;
  /** Rendered as a hidden h1 (the page title for screen readers and search engines). */
  title?: string;
  className?: string;
}) {
  const agency = useAgencyInfo();
  const name = agency.agency_name || agencyLabel(agency);
  const logo = agency.logo_url || agency.mark_url;

  // Pause the hero's loops while it is off screen (no work for animations nobody sees).
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-off', !entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={heroRef}
      className={`gc-hero${layers === 'inside' ? ' is-contained' : ''} ${className}`.trim()}
      dir="rtl"
      onPointerMove={followPointer}
      onPointerLeave={resetPointer}
    >
      {layers === 'inside' ? <AgencyHeroLayers /> : null}
      <div className="gc-hero-in">
        {title ? <h1 className="sr-only">{title} — {shortAgencyName(name)}</h1> : null}
        {/* The agency name in calligraphy, written in from right to left, with small ornaments. */}
        <p className="gc-callig" aria-label={shortAgencyName(name)}>
          <span className="gc-callig-text" aria-hidden>{calligraphyName(name)}</span>
          <i className="gc-orn is-v1" aria-hidden />
          <i className="gc-orn is-v2" aria-hidden />
          <i className="gc-orn is-v3" aria-hidden />
          <b className="gc-orn-h is-h1" aria-hidden>ه</b>
          <b className="gc-orn-h is-h2" aria-hidden>ه</b>
        </p>
        {/* The load-in runs on a wrapper, so the pointer tilt (a transform) is not overridden. */}
        <div className="gc-mark-in gc-in">
          <div className="gc-hero-mark">
            {/* On phones the ring of letters frames the crest instead of sitting at the edge. */}
            <CalligraphyRing className="gc-ring gc-ring-mobile" pathId="gc-ring-path-m" />
            <span className="gc-mark-glow" aria-hidden />
            <IslamicRosette className="gc-rosette" />
            <IslamicRosette className="gc-rosette is-inner" inner />
            <span className="gc-logo-wrap">
              {logo ? <img src={logo} alt={name} className="gc-hero-logo" /> : <b className="gc-hero-logo is-letter">{name.slice(0, 1)}</b>}
            </span>
          </div>
        </div>
        {offer ? <HeroOfferCopy /> : null}
        {showcase ? <HeroShowcase /> : null}
      </div>
    </section>
  );
}
