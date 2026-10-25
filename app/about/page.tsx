'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  CalendarCheck,
  Clock,
  Download,
  ExternalLink,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  Phone,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import TestimonialsSection from '@/components/TestimonialsSection';
import ShareBar from '@/components/social/ShareBar';
import { initialOf, photoOf, type MorshidRow } from '@/components/AboutSection';
import { useReveal } from '@/components/info/useReveal';
import { CountUp, ScrollProgress, spotlightMove, tiltHandlers } from '@/components/about/effects';
import { openSakhr } from '@/components/sakhr/openSakhr';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import { SOCIAL_ICON } from '@/components/social/SocialIcons';
import { socialProfiles } from '@/lib/social';
import { publicList, publicReviews } from '@/lib/public-catalog';
import type { PageContentRow } from '@/lib/page-content';
import { readAboutContent } from '@/lib/about-content';
import { agencyLabel, brandGeo, brandMapEmbed, brandMapUrl, connectName, telHref } from '@/lib/brand';
import '@/app/info-pages.css';
import './about.css';

/** Icons for the "why us" cards, in order (repeats when there are more cards). */
const VALUE_ICONS = [HeartHandshake, BedDouble, ReceiptText, ShieldCheck, Star, Users];

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
  const about = readAboutContent(content);
  const hero = { ...about.hero, text: about.hero.text || agency.description || 'وكالة سياحة وأسفار متخصصة في رحلات العمرة والحج، نرافقكم من لحظة اختيار البرنامج حتى عودتكم سالمين، بتنظيم واضح ومرافقة دينية متخصصة.' };
  const story = about.story;
  // The last words of the title get the brand gradient.
  const words = hero.title.split(/\s+/).filter(Boolean);
  const accentFrom = words.length >= 4 ? words.length - 2 : words.length - 1;

  const statCards = [
    { icon: CalendarCheck, value: stats.programs, decimals: 0, label: 'برامج متاحة الآن' },
    { icon: BedDouble, value: stats.hotels, decimals: 0, label: 'فنادق شريكة' },
    { icon: Users, value: team.length, decimals: 0, label: 'الطاقم والمرشدون' },
    { icon: Star, value: stats.rating, decimals: 1, label: stats.reviews ? `تقييم المعتمرين (${stats.reviews})` : 'تقييم المعتمرين' },
  ].filter((s) => s.value > 0);

  // Contact card and map from «هوية الوكالة» (the map pin, else a search for the address).
  const phone = agency.phone;
  const address = joinAddress([agency.address, agency.city, agency.country]);
  const geo = brandGeo(agency);
  const mapUrl = brandMapUrl(agency);
  const details = [
    { icon: MapPin, label: 'العنوان', value: address, href: mapUrl, ltr: false },
    phone && { icon: Phone, label: 'الهاتف', value: phone, href: telHref(phone), ltr: true },
    agency.email && { icon: Mail, label: 'البريد الإلكتروني', value: agency.email, href: `mailto:${agency.email}`, ltr: true },
    agency.opening_hours && { icon: Clock, label: 'أوقات العمل', value: agency.opening_hours, ltr: false },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; ltr: boolean }[];

  return (
    <div className="page-shell min-h-screen bg-white">
      <ScrollProgress />
      <Navbar variant="light" />

      <main className="ip ab page-main" dir="rtl">
        {/* Hero */}
        <section className="ab-hero">
          <div className="ab-hero-bg" aria-hidden>
            <span className="ab-blob is-1" />
            <span className="ab-blob is-2" />
            <span className="ab-blob is-3" />
            <span className="ab-grid" />
          </div>
          <div className="ip-wrap ab-hero-grid">
            <div className="ab-hero-text">
              <span className="ab-pill ab-in" style={delay(0)}>
                <span className="ab-pill-dot" aria-hidden />
                <BadgeCheck className="w-4 h-4" /> {name}
              </span>
              <h1 className="ab-title">
                {words.map((w, i) => (
                  <React.Fragment key={`${w}-${i}`}>
                    <span className={`ab-word${i >= accentFrom ? ' is-accent' : ''}`} style={{ '--i': i } as React.CSSProperties}>{w}</span>
                    {i < words.length - 1 ? ' ' : null}
                  </React.Fragment>
                ))}
              </h1>
              <p className="ip-lead ab-in" style={delay(4)}>{hero.text}</p>
              <div className="ip-actions ab-in" style={delay(5)}>
                <Link href="/packages" className="ip-btn is-primary ab-shine">
                  تصفح البرامج <ArrowLeft className="w-4 h-4" />
                </Link>
                <a href="#contact" className="ip-btn is-ghost">تواصل معنا</a>
              </div>
              <div className="ab-in" style={delay(6)}>
                <ShareBar className="ip-share" text={`${name} — رحلات العمرة والحج`} />
              </div>
            </div>

            <div className="ab-hero-art-wrap ab-in" style={delay(2)}>
              <div className="ab-hero-art" {...tiltHandlers(5)}>
                <img src={hero.image} alt="المسجد الحرام" />
                <div className="ab-float ab-float-badge">
                  <span><HeartHandshake className="w-4 h-4" /></span>
                  عمرة · حج · مرافقة دينية
                </div>
                {stats.rating > 0 ? (
                  <div className="ab-float ab-float-rating">
                    <Star className="w-4 h-4" aria-hidden />
                    <b dir="ltr">{stats.rating.toFixed(1)}</b>
                    <small>تقييم المعتمرين</small>
                  </div>
                ) : null}
              </div>
              <span className="ab-ring" aria-hidden />
            </div>
          </div>
        </section>

        {about.settings.stats && statCards.length ? (
          <div className="ip-wrap">
            <div className="ab-stats ip-reveal">
              {statCards.map((s) => (
                <div key={s.label} className="ab-stat">
                  <i><s.icon className="w-5 h-5" /></i>
                  <div>
                    <b dir="ltr"><CountUp value={s.value} decimals={s.decimals} /></b>
                    <small>{s.label}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Story */}
        <section className="ip-section ab-story-sec">
          <div className="ip-wrap ab-story">
            <div className="ip-reveal">
              <span className="ip-eyebrow">قصتنا</span>
              <h2 className="ip-h2">{story.title}</h2>
              <p className="ab-story-text">{story.text}</p>
            </div>
            <div className="ab-story-img ip-reveal">
              <img src={story.image} alt="" loading="lazy" />
            </div>
          </div>
        </section>

        {/* Values */}
        {about.values.items.length ? (
          <section className="ip-section is-soft">
            <div className="ip-wrap">
              <div className="ip-head ip-reveal">
                <span className="ip-eyebrow">لماذا نحن</span>
                <h2 className="ip-h2">{about.values.heading}</h2>
              </div>
              <div className="ab-cards" onPointerMove={spotlightMove}>
                {about.values.items.map((v, i) => {
                  const Icon = VALUE_ICONS[i % VALUE_ICONS.length];
                  return (
                    <article key={`${v.title}-${i}`} className="ab-card ab-spot ip-reveal" style={delay(i)}>
                      <i><Icon className="w-5 h-5" /></i>
                      <h3>{v.title}</h3>
                      <p>{v.text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {/* How it works */}
        {about.journey.items.length ? (
          <section className="ip-section">
            <div className="ip-wrap">
              <div className="ip-head ip-reveal">
                <span className="ip-eyebrow">كيف نعمل</span>
                <h2 className="ip-h2">{about.journey.heading}</h2>
              </div>
              <ol className="ab-steps ip-reveal" style={{ '--n': about.journey.items.length } as React.CSSProperties}>
                {about.journey.items.map((s, i) => (
                  <li key={`${s.title}-${i}`} className="ab-step" style={delay(i, 140)}>
                    <span className="ab-step-num">{i + 1}</span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {/* Gallery (photos added by the admin) */}
        {about.gallery.items.length ? (
          <section className="ip-section">
            <div className="ip-wrap">
              <div className="ip-head ip-reveal">
                <span className="ip-eyebrow">صور</span>
                <h2 className="ip-h2">{about.gallery.heading}</h2>
              </div>
              <div className="ip-gallery">
                {about.gallery.items.map((p, i) => (
                  <figure key={`${p.url}-${i}`} className="ip-photo ip-reveal" style={delay(i, 70)}>
                    <img src={p.url} alt={p.caption || ''} loading="lazy" />
                    {p.caption ? <figcaption>{p.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Team */}
        {about.settings.team && team.length ? (
          <section className="ip-section is-soft">
            <div className="ip-wrap">
              <div className="ip-head ip-reveal">
                <span className="ip-eyebrow">فريقنا</span>
                <h2 className="ip-h2">الطاقم والمرشدون</h2>
                <p className="ip-lead">وجوه ستلقونها في رحلتكم: إداريون ومرشدون ومرشدات يرافقونكم في كل مرحلة.</p>
              </div>
              <div className="ip-team">
                {team.map((m, i) => {
                  const photo = photoOf(m);
                  const rating = Number(m.rating) || 0;
                  const count = Number(m.reviewCount || m.review_count) || 0;
                  return (
                    <article key={m.morshid_id} className="ip-member ab-lift ip-reveal" style={delay(i, 80)}>
                      <div className="ip-member-photo">
                        {photo ? <img src={photo} alt={m.name} loading="lazy" /> : <b>{initialOf(m)}</b>}
                      </div>
                      <div className="ip-member-body">
                        <h3>{m.name}</h3>
                        {m.roleName ? <span className="ip-member-role">{m.roleName}</span> : null}
                        {rating > 0 ? (
                          <span className="ip-member-rating">
                            <Star className="w-3.5 h-3.5" /> <span dir="ltr">{rating.toFixed(1)}</span>
                            {count ? <span>({count} تقييم)</span> : null}
                          </span>
                        ) : null}
                        {Number(m.experience_years) > 0 ? <span className="ip-member-exp">{m.experience_years} سنوات خبرة</span> : null}
                        {m.bio ? <p className="ip-member-bio">{m.bio}</p> : m.specialization ? <p>{m.specialization}</p> : null}
                        {m.skills?.length ? (
                          <div className="ip-member-tags">
                            {m.skills.slice(0, 4).map((t) => <span key={t}>{t}</span>)}
                          </div>
                        ) : null}
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

        {/* Contact: two ways to get help, then where to find us */}
        <section className="ip-section is-soft" id="contact">
          <div className="ip-wrap">
            <div className="ip-head ip-reveal">
              <span className="ip-eyebrow">تواصل معنا</span>
              <h2 className="ip-h2">نحن هنا لمساعدتكم</h2>
              <p className="ip-lead">جواب فوري من صخر، مساعدنا الذكي، أو حديث مباشر مع فريق الوكالة عبر تطبيق Connect.</p>
            </div>

            <div className="ip-help" onPointerMove={spotlightMove}>
              <article className="ip-help-card is-sakhr ab-spot ip-reveal">
                <span className="ab-sakhr-glow" aria-hidden />
                <div className="ip-help-top">
                  <span className="ip-help-mark is-sakhr ab-breathe" aria-hidden>ص</span>
                  <div>
                    <h3>صخر، المساعد الذكي</h3>
                    <small>متاح في أي وقت</small>
                  </div>
                </div>
                <p>أسئلة عن البرامج والأسعار والوثائق ومناسك العمرة؟ اسألوا صخر بالكتابة أو بالصوت، والجواب فوري.</p>
                <ul className="ip-help-points">
                  <li><Sparkles className="w-4 h-4" aria-hidden /> إجابات من معلومات الوكالة</li>
                  <li><Mic className="w-4 h-4" aria-hidden /> كتابة أو صوت</li>
                </ul>
                <button type="button" className="ip-btn is-sakhr ab-shine" onClick={() => openSakhr()}>
                  <MessageCircle className="w-4 h-4" /> اسأل صخر الآن
                </button>
              </article>

              <article className="ip-help-card is-connect ab-spot ip-reveal" style={delay(1)}>
                <div className="ip-help-top">
                  <img className="ip-help-mark" src="/icons/connect-192.png" alt="" width={52} height={52} />
                  <div>
                    <h3>تطبيق {connectName(agency)}</h3>
                    <small>فريق الوكالة</small>
                  </div>
                </div>
                <p>رسائل ومكالمات صوتية مباشرة مع مستشاري الوكالة ومرشدكم، من الهاتف أو الحاسوب.</p>
                <ul className="ip-help-points">
                  <li><MessageCircle className="w-4 h-4" aria-hidden /> رسائل</li>
                  <li><PhoneCall className="w-4 h-4" aria-hidden /> مكالمات صوتية</li>
                </ul>
                <div className="ip-help-actions">
                  <Link href="/app" className="ip-btn is-primary ab-shine"><Download className="w-4 h-4" /> حمّل التطبيق</Link>
                  <Link href="/connect" className="ip-btn is-ghost">افتح Connect</Link>
                </div>
              </article>
            </div>

            <div className="ab-visit ip-reveal">
              <div className="ab-map">
                {geo ? (
                  <iframe
                    title="موقع الوكالة على الخريطة"
                    src={brandMapEmbed(agency)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
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
                <a href={mapUrl} target="_blank" rel="noreferrer" className="ip-btn is-primary ab-shine ab-visit-btn">
                  <Navigation className="w-4 h-4" /> الاتجاهات في خرائط Google <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom call to action */}
        <section className="ip-section ip-end">
          <div className="ip-wrap">
            <div className="ip-band ab-band ip-reveal">
              <span className="ab-band-orb is-1" aria-hidden />
              <span className="ab-band-orb is-2" aria-hidden />
              <div>
                <h2>جاهزون لرحلتكم القادمة؟</h2>
                <p>اختاروا برنامجكم وأرسلوا طلبكم، وسنتواصل معكم لتأكيد كل التفاصيل.</p>
              </div>
              <div className="ip-band-actions">
                <Link href="/book" className="ip-btn is-light ab-shine">احجز الآن <ArrowLeft className="w-4 h-4" /></Link>
                <Link href="/guide" className="ip-btn is-outline-light">دليل العمرة</Link>
              </div>
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
