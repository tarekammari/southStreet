'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
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
import { openSakhr } from '@/components/sakhr/openSakhr';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON } from '@/components/social/SocialIcons';
import { socialProfiles } from '@/lib/social';
import { publicList, publicReviews } from '@/lib/public-catalog';
import type { PageContentRow } from '@/lib/page-content';
import { ABOUT_DEFAULTS, readAboutContent } from '@/lib/about-content';
import { agencyLabel, brandCoordinates, brandDirectionsUrl, brandGeo, brandMapEmbed, brandMapUrl, connectName, telHref } from '@/lib/brand';
import '@/app/info-pages.css';
import './about.css';

/**
 * Clean built-in photos (no logos or captions burned in), used where the
 * admin has not chosen a photo of their own.
 */
const PHOTOS = {
  hero: '/images/kaaba_sharifa_home_page.webp',
  story: '/images/maka06.webp',
  values: '/images/maka05.webp',
  cta: '/images/maka01.webp',
  gallery: ['/images/section2_09.webp', '/images/section2_08.webp', '/images/section2_05.webp', '/images/section2_06.webp', '/images/section2_07.webp'],
};

/** "a، b، c" without repeating a part that is already in the previous ones. */
function joinAddress(parts: (string | undefined)[]): string {
  const out: string[] = [];
  for (const raw of parts) {
    const part = (raw || '').trim();
    if (part && !out.some((p) => p.includes(part))) out.push(part);
  }
  return out.join('، ');
}

/** Staggered reveal delay for the n-th item of a list. */
const delay = (i: number, step = 90) => ({ '--d': `${i * step}ms` }) as React.CSSProperties;

export default function AboutPage() {
  const [content, setContent] = useState<PageContentRow[]>([]);
  const agency = useAgencyInfo();
  const [team, setTeam] = useState<MorshidRow[]>([]);
  const [stats, setStats] = useState({ programs: 0, hotels: 0, rating: 0, reviews: 0 });

  useEffect(() => {
    publicList<PageContentRow>('content').then(setContent);
    publicList<MorshidRow>('staff').then(setTeam);
    Promise.all([publicList<unknown>('packages'), publicList<unknown>('hotels'), publicReviews()]).then(([programs, hotels, reviews]) => {
      setStats({
        programs: programs.length,
        hotels: hotels.length,
        rating: Number(reviews?.summary?.average) || 0,
        reviews: Number(reviews?.summary?.count) || 0,
      });
    });
  }, []);

  useReveal();
  const profiles = socialProfiles(agency.social);

  const name = agency.agency_name || agencyLabel(agency);
  const assistant = agency.assistant_name || 'صخر';
  const about = readAboutContent(content);
  const hero = { ...about.hero, text: about.hero.text || agency.description || 'وكالة سياحة وأسفار متخصصة في رحلات العمرة والحج، نرافقكم من لحظة اختيار البرنامج حتى عودتكم سالمين، بتنظيم واضح ومرافقة دينية متخصصة.' };
  const story = about.story;
  // An admin's own photo wins; otherwise the agency's hero start photo, then the built-in ones.
  const heroImg = about.hero.image !== ABOUT_DEFAULTS.hero.image ? about.hero.image : agency.hero_start || PHOTOS.hero;
  const storyImg = story.image !== ABOUT_DEFAULTS.story.image ? story.image : PHOTOS.story;
  const gallery = about.gallery.items.length ? about.gallery.items : PHOTOS.gallery.map((url) => ({ url, caption: '' }));
  // The last words of the title get the brand gradient.
  const words = hero.title.split(/\s+/).filter(Boolean);
  const accentFrom = words.length >= 4 ? words.length - 2 : words.length - 1;

  const statCards = [
    { value: stats.programs, decimals: 0, label: 'برامج متاحة' },
    { value: stats.hotels, decimals: 0, label: 'فنادق شريكة' },
    { value: team.length, decimals: 0, label: 'الطاقم والمرشدون' },
    { value: stats.rating, decimals: 1, label: 'تقييم المعتمرين' },
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

      <main className="ip ab lx page-main" dir="rtl">
        {/* Hero: one full-width photo, the title and two buttons */}
        <section className="lx-hero">
          <img className="lx-hero-img" src={heroImg} alt="" fetchPriority="high" decoding="async" />
          <span className="lx-hero-shade" aria-hidden />
          <div className="ip-wrap lx-hero-in">
            <span className="lx-kicker ab-in" style={delay(0)}>{name}</span>
            <h1 className="lx-title">
              {words.map((w, i) => (
                <React.Fragment key={`${w}-${i}`}>
                  <span className={`ab-word${i >= accentFrom ? ' is-accent' : ''}`} style={{ '--i': i } as React.CSSProperties}>{w}</span>
                  {i < words.length - 1 ? ' ' : null}
                </React.Fragment>
              ))}
            </h1>
            <div className="lx-actions ab-in" style={delay(5)}>
              <Link href="/packages" className="lx-btn is-gold ab-shine">
                تصفح البرامج <ArrowLeft className="w-4 h-4" />
              </Link>
              <a href="#contact" className="lx-btn is-glass">تواصل معنا</a>
            </div>
          </div>
          {stats.rating > 0 ? (
            <span className="lx-rating ab-in" style={delay(6)}>
              <Star className="w-4 h-4" aria-hidden /> <b dir="ltr">{stats.rating.toFixed(1)}</b>
            </span>
          ) : null}
        </section>

        {about.settings.stats && statCards.length ? (
          <div className="ip-wrap">
            <div className="lx-stats ip-reveal">
              {statCards.map((s) => (
                <div key={s.label} className="lx-stat">
                  <b dir="ltr"><CountUp value={s.value} decimals={s.decimals} /></b>
                  <small>{s.label}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Story: the photo fills half the screen, edge to edge */}
        <section className="lx-story" id="story">
          <div className="lx-story-media ip-reveal">
            <img src={storyImg} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="lx-story-text ip-reveal">
            <span className="lx-eyebrow">قصتنا</span>
            <h2 className="lx-h2">{story.title}</h2>
            <p>{story.text}</p>
          </div>
        </section>

        {/* Values: titles only, over a dark photo */}
        {about.values.items.length ? (
          <section className="lx-values">
            <img className="lx-bg" src={PHOTOS.values} alt="" loading="lazy" decoding="async" />
            <div className="ip-wrap">
              <span className="lx-eyebrow is-light ip-reveal">لماذا نحن</span>
              <h2 className="lx-h2 is-light ip-reveal">{about.values.heading}</h2>
              <ol className="lx-values-list">
                {about.values.items.map((v, i) => (
                  <li key={`${v.title}-${i}`} className="ip-reveal" style={delay(i, 110)} title={v.text || undefined}>
                    <span dir="ltr">{String(i + 1).padStart(2, '0')}</span>
                    <h3>{v.title}</h3>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {/* Gallery: big photos, edge to edge */}
        {gallery.length ? (
          <section className="lx-gallery-sec">
            <div className="ip-wrap lx-head ip-reveal">
              <span className="lx-eyebrow">صور</span>
              <h2 className="lx-h2">{about.gallery.heading}</h2>
            </div>
            <div className={`lx-gallery${gallery.length < 5 ? ' is-few' : ''}`}>
              {gallery.map((p, i) => (
                <figure key={`${p.url}-${i}`} className="lx-tile ip-reveal" style={delay(i, 80)}>
                  <img src={p.url} alt={p.caption || ''} loading="lazy" decoding="async" />
                  {p.caption ? <figcaption>{p.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {/* How it works: numbered steps, titles only */}
        {about.journey.items.length ? (
          <section className="ip-section lx-journey">
            <div className="ip-wrap">
              <div className="lx-head ip-reveal">
                <span className="lx-eyebrow">كيف نعمل</span>
                <h2 className="lx-h2">{about.journey.heading}</h2>
              </div>
              <ol className="ab-steps ip-reveal" style={{ '--n': about.journey.items.length } as React.CSSProperties}>
                {about.journey.items.map((s, i) => (
                  <li key={`${s.title}-${i}`} className="ab-step" style={delay(i, 140)} title={s.text || undefined}>
                    <span className="ab-step-num">{i + 1}</span>
                    <h3>{s.title}</h3>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {/* Team: portraits with name and role */}
        {about.settings.team && team.length ? (
          <section className="ip-section lx-team-sec">
            <div className="ip-wrap">
              <div className="lx-head ip-reveal">
                <span className="lx-eyebrow">فريقنا</span>
                <h2 className="lx-h2">الطاقم والمرشدون</h2>
              </div>
              <div className="lx-team">
                {team.map((m, i) => {
                  const photo = photoOf(m);
                  return (
                    <article key={m.morshid_id} className="lx-member ip-reveal" style={delay(i, 80)}>
                      {photo ? <img src={photo} alt={m.name} loading="lazy" decoding="async" /> : <b className="lx-member-initial">{initialOf(m)}</b>}
                      <div className="lx-member-name">
                        <h3>{m.name}</h3>
                        {m.roleName ? <small>{m.roleName}</small> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {/* Reviews (existing component, shows only approved reviews) */}
        {about.settings.reviews ? <TestimonialsSection /> : null}

        {/* Contact: the assistant, the Connect app, then where to find us */}
        <section className="ip-section lx-contact" id="contact">
          <div className="ip-wrap">
            <div className="lx-head ip-reveal">
              <span className="lx-eyebrow">تواصل معنا</span>
              <h2 className="lx-h2">نحن هنا لمساعدتكم</h2>
            </div>

            <div className="ip-help">
              <article className="ip-help-card is-sakhr ip-reveal">
                <div className="ip-help-top">
                  <span className="ip-help-mark is-sakhr" aria-hidden>{assistant.slice(0, 1)}</span>
                  <div>
                    <h3>{assistant}، المساعد الذكي</h3>
                    <small>كتابة أو صوت · في أي وقت</small>
                  </div>
                </div>
                <button type="button" className="ip-btn is-sakhr ab-shine" onClick={() => openSakhr()}>
                  <MessageCircle className="w-4 h-4" /> اسأل {assistant}
                </button>
              </article>

              <article className="ip-help-card is-connect ip-reveal" style={delay(1)}>
                <div className="ip-help-top">
                  <img className="ip-help-mark" src="/icons/connect-192.png" alt="" width={52} height={52} loading="lazy" />
                  <div>
                    <h3>تطبيق {connectName(agency)}</h3>
                    <small>رسائل ومكالمات مع فريق الوكالة</small>
                  </div>
                </div>
                <div className="ip-help-actions">
                  <Link href="/app" className="ip-btn is-primary ab-shine"><Download className="w-4 h-4" /> حمّل التطبيق</Link>
                  <Link href="/connect" className="ip-btn is-ghost">افتح Connect</Link>
                </div>
              </article>
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
                <h3>زورونا في الوكالة</h3>
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
                <a href={directionsUrl} target="_blank" rel="noreferrer" className="ip-btn is-primary ab-shine ab-visit-btn">
                  <Navigation className="w-4 h-4" /> الاتجاهات إلى الوكالة <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Closing call to action over a full-width photo */}
        <section className="lx-cta">
          <img className="lx-bg" src={PHOTOS.cta} alt="" loading="lazy" decoding="async" />
          <div className="ip-wrap lx-cta-in ip-reveal">
            <h2>جاهزون لرحلتكم القادمة؟</h2>
            <div className="lx-actions">
              <Link href="/book" className="lx-btn is-gold ab-shine">احجز الآن <ArrowLeft className="w-4 h-4" /></Link>
              <Link href="/guide" className="lx-btn is-glass">دليل العمرة</Link>
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
              description: hero.text,
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
