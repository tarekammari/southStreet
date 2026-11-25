'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Leaf,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Star,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import TestimonialsSection from '@/components/TestimonialsSection';
import { initialOf, photoOf, type MorshidRow } from '@/components/AboutSection';
import { useReveal } from '@/components/info/useReveal';
import { CountUp, ScrollProgress } from '@/components/about/effects';
import { CalligraphyRing, IslamicArabesque, IslamicPattern, IslamicRosette } from '@/components/about/IslamicOrnament';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON } from '@/components/social/SocialIcons';
import { socialProfiles } from '@/lib/social';
import { publicList, publicReviews } from '@/lib/public-catalog';
import type { PageContentRow } from '@/lib/page-content';
import type { Package } from '@/types';
import { ABOUT_DEFAULTS, readAboutContent } from '@/lib/about-content';
import { formatProgramDate, isBookable, programAvailability, programMinPrice } from '@/lib/program-display';
import { agencyLabel, brandCoordinates, brandDirectionsUrl, brandGeo, brandMapEmbed, brandMapUrl, telHref } from '@/lib/brand';
import '@/app/info-pages.css';
import './about.css';

/**
 * Clean built-in photos (no logos or captions burned in), used where the
 * admin has not chosen a photo of their own.
 */
const PHOTOS = {
  story: '/images/maka06.webp',
  cta: '/images/section2_09.webp',
};

/** Programs marked «مميز» by the admin (not in the shared Package type). */
const isFeatured = (pkg: Package) => Boolean((pkg as Package & { featured?: unknown }).featured);

type Review = { id: string; reviewerName: string; stars: number; body: string };

/** "a، b، c" without repeating a part that is already in the previous ones. */
function joinAddress(parts: (string | undefined)[]): string {
  const out: string[] = [];
  for (const raw of parts) {
    const part = (raw || '').trim();
    if (part && !out.some((p) => p.includes(part))) out.push(part);
  }
  return out.join('، ');
}

/** A title whose last words are set in the serif accent. */
function Accent({ text, words = 2 }: { text: string; words?: number }) {
  const parts = text.split(/\s+/).filter(Boolean);
  const cut = parts.length > words ? parts.length - words : Math.max(parts.length - 1, 0);
  const head = parts.slice(0, cut).join(' ');
  const tail = parts.slice(cut).join(' ');
  return (
    <>
      {head}
      {head && tail ? ' ' : null}
      {tail ? <em>{tail}</em> : null}
    </>
  );
}

/**
 * Pointer position over the hero as --hx / --hy (-0.5 … 0.5), once per frame.
 * CSS turns these into the logo tilt, its light and the pattern parallax.
 */
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
/** The agency name for the calligraphy line: no trailing "تور", with harakat where known. */
function calligraphyName(name: string): string {
  return name
    .replace(/\s+(تور|تورز|tours?)$/i, '')
    .split(/\s+/)
    .map((w) => TASHKEEL[w] || w)
    .join(' ');
}

/** Staggered reveal delay for the n-th item of a list. */
const delay = (i: number, step = 90) => ({ '--d': `${i * step}ms` }) as React.CSSProperties;

export default function AboutPage() {
  const [content, setContent] = useState<PageContentRow[]>([]);
  const agency = useAgencyInfo();
  const [team, setTeam] = useState<MorshidRow[]>([]);
  const [programs, setPrograms] = useState<Package[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ hotels: 0, rating: 0, reviews: 0 });
  const [reviewForm, setReviewForm] = useState(false);

  useEffect(() => {
    publicList<PageContentRow>('content').then(setContent);
    publicList<MorshidRow>('staff').then(setTeam);
    publicList<Package>('packages').then(setPrograms);
    Promise.all([publicList<unknown>('hotels'), publicReviews()]).then(([hotels, r]) => {
      setReviews(Array.isArray(r?.reviews) ? r.reviews : []);
      setStats({
        hotels: hotels.length,
        rating: Number(r?.summary?.average) || 0,
        reviews: Number(r?.summary?.count) || 0,
      });
    });
  }, []);

  useReveal();
  const profiles = socialProfiles(agency.social);

  const name = agency.agency_name || agencyLabel(agency);
  const about = readAboutContent(content);
  const intro = about.hero.text || agency.description || 'وكالة متخصصة في رحلات العمرة والحج، بنفس الوجوه ونفس العناية من الحجز حتى العودة.';
  const story = about.story;
  // An admin's own photo wins; otherwise the built-in one.
  const storyImg = story.image !== ABOUT_DEFAULTS.story.image ? story.image : PHOTOS.story;
  const logo = agency.logo_url || agency.mark_url;
  const lead = team.find((m) => photoOf(m)) || team[0];

  // Programs still open (or opening soon), the featured one in the middle.
  const plans = programs
    .map((pkg) => ({ pkg, availability: programAvailability(pkg) }))
    .filter((p) => p.availability !== 'expired')
    .sort((a, b) => Number(isFeatured(b.pkg)) - Number(isFeatured(a.pkg)))
    .slice(0, 3);
  const featuredAt = plans.length === 3 ? 1 : 0;
  const orderedPlans = plans.length === 3 ? [plans[1], plans[0], plans[2]] : plans;

  const statCards = [
    { value: programs.length, decimals: 0, suffix: '', label: 'برامج' },
    { value: stats.hotels, decimals: 0, suffix: '+', label: 'فنادق شريكة' },
    { value: team.length, decimals: 0, suffix: '', label: 'مرشدون وطاقم' },
    { value: stats.rating, decimals: 1, suffix: '', label: 'تقييم المعتمرين' },
  ].filter((s) => s.value > 0);

  // Contact card and map from «هوية الوكالة» (the map pin, else a search for the address).
  const phone = agency.phone;
  const address = joinAddress([agency.address, agency.city, agency.country]);
  const geo = brandGeo(agency);
  const mapUrl = brandMapUrl(agency);
  const directionsUrl = brandDirectionsUrl(agency);
  const coordinates = brandCoordinates(agency);
  const details = [
    { icon: MapPin, label: 'العنوان', value: address, href: mapUrl, ltr: false },
    phone && { icon: Phone, label: 'الهاتف', value: phone, href: telHref(phone), ltr: true },
    agency.email && { icon: Mail, label: 'البريد الإلكتروني', value: agency.email, href: `mailto:${agency.email}`, ltr: true },
    ...agency.phones.map((p) => ({ icon: Phone, label: p.label || 'هاتف', value: p.number, href: telHref(p.number), ltr: true })),
    ...agency.branches.map((b) => ({
      icon: MapPin,
      label: `فرع ${b.city}`.trim(),
      value: [b.address, b.phone].filter(Boolean).join(' · '),
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.address, b.city].filter(Boolean).join('، '))}`,
      ltr: false,
    })),
    agency.opening_hours && { icon: Clock, label: 'أوقات العمل', value: agency.opening_hours, ltr: false },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; ltr: boolean }[];

  return (
    <div className="page-shell min-h-screen bg-white">
      <ScrollProgress />
      <Navbar variant="light" />

      <main className="ip gc page-main" dir="rtl">
        {/* Hero: white, with a gold-and-green Islamic pattern at the edges, a turning ring
            of calligraphy, and an arch-shaped panel in the centre with the logo, title and
            one line. The logo and pattern follow the pointer. */}
        <section className="gc-hero" onPointerMove={followPointer} onPointerLeave={resetPointer}>
          <div className="gc-hero-pattern" aria-hidden><IslamicPattern /></div>
          <div className="gc-ring-wrap" aria-hidden><CalligraphyRing className="gc-ring" /></div>
          <div className="gc-hero-in">
            {/* The agency name in calligraphy, written in from right to left, with small ornaments. */}
            <p className="gc-callig" aria-label={name.replace(/\s+(تور|تورز|tours?)$/i, '')}>
              <span className="gc-callig-text" aria-hidden>{calligraphyName(name)}</span>
              <i className="gc-orn is-v1" aria-hidden />
              <i className="gc-orn is-v2" aria-hidden />
              <i className="gc-orn is-v3" aria-hidden />
              <b className="gc-orn-h is-h1" aria-hidden>ه</b>
              <b className="gc-orn-h is-h2" aria-hidden>ه</b>
            </p>
            {/* The load-in runs on a wrapper, so the pointer tilt (a transform) is not overridden. */}
            <div className="gc-mark-in ab-in">
            <div className="gc-hero-mark">
              <span className="gc-mark-glow" aria-hidden />
              <IslamicRosette className="gc-rosette" />
              <IslamicRosette className="gc-rosette is-inner" inner />
              <span className="gc-logo-wrap">
                {logo ? <img src={logo} alt={name} className="gc-hero-logo" /> : <b className="gc-hero-logo is-letter">{name.slice(0, 1)}</b>}
              </span>
            </div>
            </div>
            <div className="gc-hero-panel ab-in" style={delay(2)}>
              <span className="gc-panel-art" aria-hidden><IslamicArabesque /></span>
              <h1 className="gc-h1"><Accent text={about.hero.title} /></h1>
              <span className="gc-hero-rule" aria-hidden><i /></span>
              <p className="gc-intro">{intro}</p>
              <nav className="gc-crumbs" aria-label="مسار الصفحة">
                <Link href="/">الرئيسية</Link>
                <span aria-hidden>/</span>
                <span aria-current="page">عن الوكالة</span>
              </nav>
            </div>
          </div>
        </section>

        {/* About us: photo + story, a short checklist and the person behind it */}
        <section className="gc-section">
          <div className="ip-wrap gc-about">
            <div className="gc-about-media ip-reveal">
              <img src={storyImg} alt="" loading="lazy" decoding="async" />
            </div>
            <div className="gc-about-text">
              <span className="gc-tag ip-reveal"><Leaf aria-hidden /> من نحن</span>
              <h2 className="gc-h2 ip-reveal"><Accent text={story.title === ABOUT_DEFAULTS.story.title ? `رفقاؤكم في رحلة العمر` : story.title} /></h2>
              <p className="gc-text ip-reveal">{story.text}</p>
              {about.values.items.length ? (
                <ul className="gc-checks">
                  {about.values.items.slice(0, 5).map((v, i) => (
                    <li key={`${v.title}-${i}`} className="ip-reveal" style={delay(i, 70)}>
                      <span aria-hidden><Check /></span>
                      {v.title}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="gc-person ip-reveal">
                {lead && photoOf(lead) ? (
                  <img src={photoOf(lead)} alt="" loading="lazy" />
                ) : agency.mark_url || agency.logo_url ? (
                  <img src={agency.mark_url || agency.logo_url} alt="" loading="lazy" className="is-logo" />
                ) : (
                  <b>{lead ? initialOf(lead) : name.slice(0, 1)}</b>
                )}
                <div>
                  <strong>{lead?.name || name}</strong>
                  <small>{lead?.roleName || 'وكالة سياحة وأسفار'}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Numbers */}
        {about.settings.stats && statCards.length ? (
          <section className="gc-section gc-stats-sec">
            <div className="ip-wrap">
              <h2 className="gc-h2 is-center ip-reveal">تجربتنا <em>تتحدث عنا</em></h2>
              <div className="gc-stats">
                {statCards.map((s, i) => (
                  <div key={s.label} className="gc-stat ip-reveal" style={delay(i, 100)}>
                    <b dir="ltr"><CountUp value={s.value} decimals={s.decimals} />{s.suffix}</b>
                    <small>{s.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Programs as plan cards */}
        {orderedPlans.length ? (
          <section className="gc-section">
            <div className="ip-wrap">
              <div className="gc-center-head">
                <span className="gc-tag ip-reveal"><Leaf aria-hidden /> البرامج</span>
                <h2 className="gc-h2 is-center ip-reveal">اختاروا <em>البرنامج</em> المناسب لكم</h2>
                <p className="gc-sub ip-reveal">أسعار واضحة. نفس المرشد من الذهاب حتى العودة.</p>
              </div>
              <div className={`gc-plans is-${orderedPlans.length}`}>
                {orderedPlans.map(({ pkg, availability }, i) => {
                  const price = programMinPrice(pkg);
                  const featured = orderedPlans.length === 1 || i === featuredAt;
                  const points = [
                    pkg.start_date ? `الانطلاق ${formatProgramDate(pkg.start_date)}` : '',
                    pkg.duration_days ? `${pkg.duration_days} يوماً` : '',
                    pkg.departure_city ? `من ${pkg.departure_city}${pkg.departure_airport ? ` · ${pkg.departure_airport}` : ''}` : '',
                    pkg.makkah_hotel_name ? `مكة: ${pkg.makkah_hotel_name}` : '',
                    pkg.madinah_hotel_name ? `المدينة: ${pkg.madinah_hotel_name}` : '',
                    pkg.morshid_name ? `برفقة ${pkg.morshid_name}` : '',
                    Number(pkg.available) > 0 ? `${pkg.available} مقعداً متاحاً` : '',
                  ].filter(Boolean).slice(0, 6);
                  return (
                    <article key={pkg.package_id} className={`gc-plan ip-reveal${featured ? ' is-featured' : ''}`} style={delay(i, 120)}>
                      {featured && isFeatured(pkg) ? <span className="gc-plan-flag">الأكثر طلباً</span> : null}
                      <span className="gc-plan-kind">{pkg.season_name || pkg.type || 'برنامج'}</span>
                      <h3>{pkg.name}</h3>
                      <p className="gc-plan-price">
                        {price > 0 ? (
                          <>
                            <b>{price.toLocaleString('ar-DZ')}</b> <small>دج / للشخص</small>
                          </>
                        ) : (
                          <b className="is-ask">السعر عند الطلب</b>
                        )}
                      </p>
                      <ul>
                        {points.map((p) => <li key={p}>{p}</li>)}
                      </ul>
                      <Link href={`/packages/${encodeURIComponent(pkg.package_id)}`} className="gc-btn">
                        {isBookable(availability) ? 'التفاصيل والحجز' : 'التفاصيل'} <ArrowLeft aria-hidden />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {/* Reviews */}
        {about.settings.reviews ? (
          reviews.length ? (
            <section className="gc-section">
              <div className="ip-wrap">
                <div className="gc-center-head">
                  <span className="gc-tag ip-reveal"><Leaf aria-hidden /> آراء المعتمرين</span>
                  <h2 className="gc-h2 is-center ip-reveal">ماذا قال ضيوفنا <em>بعد رحلتهم</em></h2>
                  {stats.rating > 0 ? (
                    <p className="gc-sub ip-reveal"><Star className="gc-star" aria-hidden /> <span dir="ltr">{stats.rating.toFixed(1)}</span> من {stats.reviews} تقييم</p>
                  ) : null}
                </div>
                <div className="gc-reviews">
                  {reviews.slice(0, 6).map((r, i) => (
                    <figure key={r.id} className="gc-review ip-reveal" style={delay(i % 3, 100)}>
                      <span className="gc-review-stars" aria-label={`${r.stars} من 5`}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(r.stars))))}</span>
                      <blockquote>{r.body}</blockquote>
                      <figcaption>
                        <b aria-hidden>{(r.reviewerName || '؟').slice(0, 1)}</b>
                        {r.reviewerName}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="gc-section">
              <div className="ip-wrap">
                <div className="gc-center-head">
                  <span className="gc-tag ip-reveal"><Leaf aria-hidden /> آراء المعتمرين</span>
                  <h2 className="gc-h2 is-center ip-reveal">شاركونا <em>تجربتكم</em></h2>
                  <p className="gc-sub ip-reveal">سافرتم معنا؟ كونوا أول من يكتب رأيه.</p>
                  {!reviewForm ? (
                    <button type="button" className="gc-btn is-light gc-review-open ip-reveal" onClick={() => setReviewForm(true)}>
                      <Star aria-hidden /> اكتبوا تقييمكم
                    </button>
                  ) : null}
                </div>
              </div>
              {reviewForm ? <TestimonialsSection /> : null}
            </section>
          )
        ) : null}

        {/* Visit: map + details */}
        <section className="gc-section" id="contact">
          <div className="ip-wrap">
            <div className="gc-center-head">
              <span className="gc-tag ip-reveal"><Leaf aria-hidden /> تواصل معنا</span>
              <h2 className="gc-h2 is-center ip-reveal">زورونا <em>في الوكالة</em></h2>
            </div>
            <div className="ab-visit ip-reveal">
              <div className="ab-map">
                {geo ? (
                  <>
                    <iframe
                      title="موقع الوكالة على الخريطة"
                      src={brandMapEmbed(agency)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                    {/* Place card over the map, as in the big map apps: who, where, and the route. */}
                    <div className="ab-place">
                      <div className="ab-place-head">
                        {agency.mark_url || agency.logo_url ? <img src={agency.mark_url || agency.logo_url} alt="" className="ab-place-logo" /> : <span className="ab-place-logo is-pin"><MapPin className="w-5 h-5" /></span>}
                        <div>
                          <b>{name}</b>
                          <small>{address}</small>
                        </div>
                      </div>
                      {coordinates ? <p className="ab-place-geo" dir="ltr"><MapPin className="w-3.5 h-3.5" aria-hidden /> {coordinates}</p> : null}
                      <div className="ab-place-acts">
                        <a href={directionsUrl} target="_blank" rel="noreferrer" className="ab-place-go">
                          <Navigation className="w-4 h-4" /> الاتجاهات
                        </a>
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="ab-place-open" aria-label="فتح الموقع في الخرائط">
                          <ExternalLink className="w-4 h-4" /> الخريطة
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <a className="ab-map-cover" href={mapUrl} target="_blank" rel="noreferrer">
                    <span className="ab-map-pin" aria-hidden><MapPin className="w-6 h-6" /></span>
                    <b>افتح العنوان في الخريطة</b>
                  </a>
                )}
              </div>
              <div className="ab-visit-info">
                <div className="ab-details">
                  {details.map((d) => {
                    const body = (
                      <>
                        <i><d.icon className="w-[18px] h-[18px]" /></i>
                        <div>
                          <small>{d.label}</small>
                          <b dir={d.ltr ? 'ltr' : undefined}>{d.value}</b>
                        </div>
                      </>
                    );
                    return d.href ? (
                      <a key={d.label} href={d.href} className="ab-detail" target={d.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                        {body}
                      </a>
                    ) : (
                      <div key={d.label} className="ab-detail">{body}</div>
                    );
                  })}
                </div>
                {profiles.length ? (
                  <div className="ab-follow">
                    <span>تابعونا</span>
                    {profiles.map((p) => {
                      const Icon = SOCIAL_ICON[p.key];
                      return (
                        <a key={p.key} href={p.url} target="_blank" rel="noreferrer" className={`hero-social is-${p.key}`} aria-label={p.label} title={p.label}>
                          <Icon />
                        </a>
                      );
                    })}
                  </div>
                ) : null}
                <a href={directionsUrl} target="_blank" rel="noreferrer" className="gc-btn ab-visit-btn">
                  <Navigation aria-hidden /> الاتجاهات إلى الوكالة
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Closing: a photo that fades in from the page */}
        <section className="gc-cta">
          <img className="gc-cta-img" src={PHOTOS.cta} alt="" loading="lazy" decoding="async" />
          <div className="ip-wrap gc-cta-in ip-reveal">
            <h2 className="gc-h2 is-center">جاهزون لرحلة <em>العمر</em>؟</h2>
            <p>اختاروا برنامجكم وأرسلوا طلبكم، وسنتواصل معكم لتأكيد التفاصيل.</p>
            <div className="gc-cta-actions">
              <Link href="/book" className="gc-btn">احجز الآن <ArrowLeft aria-hidden /></Link>
              <Link href="/packages" className="gc-btn is-light">تصفح البرامج</Link>
            </div>
          </div>
        </section>
      </main>

      {agency.agency_name ? (
        <script
          type="application/ld+json"
          // Structured data so search engines show the agency's name, phone, address and map pin.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'TravelAgency',
              name: agency.agency_name,
              description: intro,
              // From the brand, not window: the same on the server and in the browser.
              url: agency.website || undefined,
              logo: agency.website ? new URL(agency.logo_url, agency.website).href : agency.logo_url,
              telephone: phone ? telHref(phone).slice(4) : undefined,
              email: agency.email,
              address: {
                '@type': 'PostalAddress',
                streetAddress: agency.address,
                addressLocality: agency.city.replace(/^ولاية\s+/, '') || undefined,
                addressRegion: agency.city || undefined,
                addressCountry: 'DZ',
              },
              geo: geo ? { '@type': 'GeoCoordinates', ...geo } : undefined,
              hasMap: mapUrl,
              openingHours: agency.opening_hours,
            }).replace(/</g, '\\u003c'),
          }}
        />
      ) : null}
      <Footer content={content} hideCta />
      <SakhrAgent />
    </div>
  );
}
