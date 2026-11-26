'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { publicList } from '@/lib/public-catalog';

/**
 * Three illustrations under the agency hero, without card backgrounds:
 *  - Umrah: the Kaaba inside a golden lattice crescent, with two lanterns.
 *  - Flights: an Air Algérie airliner among drifting clouds.
 *  - Hotels: a hotel from the app, its photo in a gold arch.
 * The first two are inline SVG (no image files); every part only moves with
 * transform / opacity. Styles: components/about/agency-hero.css (.hs-*).
 */

/** Real photos we have for hotels whose catalogue photo is a stock one. */
const LOCAL_HOTEL_PHOTOS: Record<string, string> = {
  htl_swissotel_makkah: '/images/hotel_swiss_makaa_03.webp',
};
type HotelRow = { hotel_id: string; name: string; city?: string; stars?: number | string; images?: string[]; shown_on_site?: unknown };
type Pick = { name: string; photo: string; stars: number };
const FALLBACK_HOTEL: Pick = { name: 'فندق سويس أوتيل مكة', photo: '/images/hotel_swiss_makaa_03.webp', stars: 5 };

/** The hotel to show: a Makkah hotel shown on the site, best rated first. */
function pickHotel(rows: HotelRow[]): Pick {
  const shown = rows.filter((h) => h.shown_on_site !== false && h.shown_on_site !== 0);
  const makkah = shown.filter((h) => /مك|makk|mecc/i.test(String(h.city || '')));
  const pool = (makkah.length ? makkah : shown).slice().sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0));
  const withLocal = pool.find((h) => LOCAL_HOTEL_PHOTOS[h.hotel_id]);
  const h = withLocal || pool[0];
  if (!h) return FALLBACK_HOTEL;
  const photo = LOCAL_HOTEL_PHOTOS[h.hotel_id] || (Array.isArray(h.images) ? h.images[0] : '') || FALLBACK_HOTEL.photo;
  return { name: String(h.name || '').replace(/\s*\(.*\)\s*$/, ''), photo, stars: Math.min(5, Number(h.stars) || 5) };
}

function KaabaCrescent() {
  return (
    <svg className="hs-art hs-kaaba" viewBox="0 0 260 240" aria-hidden focusable="false">
      <defs>
        <linearGradient id="hs-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e6ae" />
          <stop offset=".45" stopColor="#d4ad57" />
          <stop offset="1" stopColor="#8a6a24" />
        </linearGradient>
        <pattern id="hs-lattice" width="22" height="22" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#7a5c1c" strokeWidth=".9" opacity=".55">
            <rect x="5" y="5" width="12" height="12" />
            <rect x="5" y="5" width="12" height="12" transform="rotate(45 11 11)" />
            <path d="M0 0 L5 5 M22 0 L17 5 M0 22 L5 17 M22 22 L17 17" />
          </g>
        </pattern>
        <mask id="hs-crescent">
          <circle cx="116" cy="130" r="100" fill="#fff" />
          <circle cx="150" cy="104" r="84" fill="#000" />
        </mask>
        <linearGradient id="hs-kl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#262626" /><stop offset="1" stopColor="#0c0c0c" /></linearGradient>
        <linearGradient id="hs-kr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#151515" /><stop offset="1" stopColor="#050505" /></linearGradient>
      </defs>

      {/* Crescent: gold with a lattice, softly shining */}
      <g className="hs-moon">
        <g mask="url(#hs-crescent)">
          <circle cx="116" cy="130" r="100" fill="url(#hs-gold)" />
          <circle cx="116" cy="130" r="100" fill="url(#hs-lattice)" />
          <rect className="hs-shine" x="-60" y="20" width="40" height="230" fill="#fff" opacity=".35" transform="rotate(20 116 130)" />
        </g>
      </g>

      {/* Lanterns on their strings */}
      <g className="hs-lantern is-a">
        <line x1="40" y1="0" x2="40" y2="34" stroke="#b8913f" strokeWidth="1.2" />
        <path d="M31 40 L40 32 L49 40 Z" fill="url(#hs-gold)" />
        <rect x="31" y="40" width="18" height="26" rx="4" fill="url(#hs-gold)" />
        <rect x="35" y="44" width="10" height="18" rx="2.5" fill="#fff3c4" className="hs-glow" />
        <path d="M33 66 L47 66 L40 74 Z" fill="url(#hs-gold)" />
      </g>
      <g className="hs-lantern is-b">
        <line x1="236" y1="0" x2="236" y2="22" stroke="#b8913f" strokeWidth="1.2" />
        <path d="M228 28 L236 20 L244 28 Z" fill="url(#hs-gold)" />
        <rect x="228" y="28" width="16" height="22" rx="4" fill="url(#hs-gold)" />
        <rect x="231.5" y="31.5" width="9" height="15" rx="2.5" fill="#fff3c4" className="hs-glow" />
        <path d="M230 50 L242 50 L236 57 Z" fill="url(#hs-gold)" />
      </g>

      {/* The Kaaba: two black faces and the top, the gold band, the door, the white kiswa hem */}
      <g className="hs-kaaba-body">
        <ellipse cx="160" cy="206" rx="70" ry="8" fill="#0b3d2a" opacity=".18" />
        <path d="M152 96 L222 110 L168 126 L98 112 Z" fill="#2e2e2e" />
        <path d="M98 112 L168 126 L168 208 L98 194 Z" fill="url(#hs-kl)" />
        <path d="M168 126 L222 110 L222 192 L168 208 Z" fill="url(#hs-kr)" />
        <path d="M98 127 L168 141 L168 150 L98 136 Z" fill="url(#hs-gold)" />
        <path d="M168 141 L222 125 L222 134 L168 150 Z" fill="url(#hs-gold)" opacity=".85" />
        <g fill="#0c0c0c">
          <circle cx="110" cy="132.5" r="2" /><circle cx="126" cy="135.7" r="2" /><circle cx="142" cy="138.9" r="2" /><circle cx="158" cy="142.1" r="2" />
          <circle cx="182" cy="141.5" r="1.8" /><circle cx="196" cy="137.4" r="1.8" /><circle cx="210" cy="133.3" r="1.8" />
        </g>
        <path d="M139 156 L155 159 L155 182 L139 179 Z" fill="url(#hs-gold)" />
        <path d="M98 172 q6 9 12 2.4 q6 9 12 2.4 q6 9 12 2.4 q6 9 12 2.4 q6 9 11 2.2 q6 9 11 2.2 L168 208 L98 194 Z" fill="#f4f1ea" />
        <path d="M168 186 q5 8 9 -1.6 q5 8 9 -1.6 q5 8 9 -1.6 q5 8 9 -1.6 q5 8 9 -1.6 q5 8 9 -1.6 L222 192 L168 208 Z" fill="#dcd6c8" />
      </g>

      {/* Sparkles */}
      <g fill="#e3c57a">
        <path className="hs-spark" d="M200 60 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
        <path className="hs-spark is-2" d="M70 30 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5z" />
        <path className="hs-spark is-3" d="M238 150 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5z" />
      </g>
    </svg>
  );
}

function AirAlgeriePlane() {
  return (
    <svg className="hs-art hs-plane" viewBox="0 0 300 220" aria-hidden focusable="false">
      <defs>
        <linearGradient id="hs-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#eef1f5" />
          <stop offset="1" stopColor="#c9d0da" />
        </linearGradient>
        <linearGradient id="hs-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7ebf0" />
          <stop offset="1" stopColor="#a9b3c0" />
        </linearGradient>
        <linearGradient id="hs-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8102e" />
          <stop offset="1" stopColor="#e2343f" />
        </linearGradient>
        <filter id="hs-soft" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0b3d2a" floodOpacity=".18" />
        </filter>
      </defs>

      {/* Clouds drifting behind and in front */}
      <g className="hs-clouds is-back" fill="#fff" filter="url(#hs-soft)">
        <path d="M30 150 a14 14 0 0 1 24 -8 a18 18 0 0 1 32 4 a12 12 0 0 1 2 24 h-56 a11 11 0 0 1 -2 -20z" />
        <path d="M200 60 a10 10 0 0 1 17 -6 a13 13 0 0 1 23 3 a9 9 0 0 1 1 17 h-40 a8 8 0 0 1 -1 -14z" opacity=".9" />
      </g>

      {/* Contrails */}
      <g className="hs-trail" stroke="#fff" strokeLinecap="round" strokeWidth="3">
        <line x1="10" y1="132" x2="120" y2="128" opacity=".9" />
        <line x1="30" y1="140" x2="118" y2="136" opacity=".6" />
      </g>

      <g className="hs-jet" filter="url(#hs-soft)">
        {/* far wing */}
        <path d="M176 100 L206 70 L216 70 L196 102 Z" fill="#b8c1cd" />
        {/* tail fin with the red emblem */}
        <path d="M62 98 L40 40 Q38 33 47 34 L62 36 L106 96 Z" fill="url(#hs-body)" />
        <circle cx="58" cy="60" r="10" fill="url(#hs-red)" />
        <path d="M52.5 64.5 L58 53 L63.5 64.5 L58 61 Z" fill="#fff" />
        {/* stabiliser */}
        <path d="M70 104 L40 114 L48 117 L86 108 Z" fill="url(#hs-wing)" />
        {/* fuselage */}
        <path d="M60 96 L238 92 Q272 94 280 108 Q274 121 240 122 L74 122 Q54 120 50 110 Q50 100 60 96 Z" fill="url(#hs-body)" />
        {/* red sweep under the tail and the cheat line */}
        <path d="M50 110 Q62 122 90 120 Q120 117 140 113 L140 117 Q112 123 86 124 Q60 124 50 110 Z" fill="url(#hs-red)" />
        <path d="M86 112 L250 108" stroke="#c8102e" strokeWidth="2.2" />
        {/* windows and cockpit */}
        <line x1="100" y1="103" x2="236" y2="100" stroke="#28406b" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0.1 7" />
        <path d="M258 99 Q266 100 270 104 L260 104 Z" fill="#1d2f4d" />
        {/* name */}
        <text x="120" y="96" className="hs-livery">AIR ALGERIE</text>
        {/* near wing and engine */}
        <path d="M150 116 L104 168 L120 170 L190 120 Z" fill="url(#hs-wing)" />
        <path d="M104 168 L98 160 L104 158 L112 167 Z" fill="#c8102e" />
        <ellipse cx="150" cy="134" rx="20" ry="9" fill="url(#hs-body)" />
        <ellipse cx="168" cy="134" rx="3.5" ry="9" fill="#c8102e" />
        <ellipse cx="169" cy="134" rx="2" ry="6.5" fill="#28344a" />
      </g>

      <g className="hs-clouds is-front" fill="#fff" filter="url(#hs-soft)">
        <path d="M190 176 a13 13 0 0 1 22 -7 a16 16 0 0 1 29 4 a11 11 0 0 1 2 21 h-51 a10 10 0 0 1 -2 -18z" />
      </g>
    </svg>
  );
}

function HotelArch({ hotel }: { hotel: Pick }) {
  return (
    <span className="hs-art hs-hotel">
      <span className="hs-stars" aria-hidden>{'★'.repeat(hotel.stars)}</span>
      <span className="hs-arch">
        <img src={hotel.photo} alt="" loading="lazy" decoding="async" />
      </span>
    </span>
  );
}

export default function HeroShowcase() {
  const [hotel, setHotel] = useState<Pick>(FALLBACK_HOTEL);
  useEffect(() => {
    publicList<HotelRow>('hotels').then((rows) => setHotel(pickHotel(rows || []))).catch(() => {});
  }, []);

  const items = [
    { key: 'kaaba', href: '/packages', title: 'العمرة والحج', sub: 'برامج إلى بيت الله الحرام', art: <KaabaCrescent /> },
    { key: 'plane', href: '/book', title: 'رحلات جوية', sub: 'مع الخطوط الجوية الجزائرية', art: <AirAlgeriePlane /> },
    { key: 'hotel', href: '/hotels', title: 'فنادق قريبة من الحرم', sub: hotel.name, art: <HotelArch hotel={hotel} /> },
  ];

  return (
    <div className="hs-row">
      {items.map((c, i) => (
        <Link key={c.key} href={c.href} className={`hs-item is-${c.key} hs-in`} style={{ animationDelay: `${300 + i * 140}ms` }}>
          <span className="hs-stage">{c.art}</span>
          <b>{c.title}</b>
          <small>{c.sub}</small>
        </Link>
      ))}
    </div>
  );
}
