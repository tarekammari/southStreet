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
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
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
import { openSakhr } from '@/components/sakhr/openSakhr';
import { publicAgency, publicList, publicReviews } from '@/lib/public-catalog';
import type { PageContentRow } from '@/lib/page-content';
import { readAboutContent } from '@/lib/about-content';
import { AGENCY_ADDRESS, AGENCY_CITY, AGENCY_COUNTRY, AGENCY_PHONE, telHref } from '@/lib/agency-contact';
import '@/app/info-pages.css';

type AgencyInfo = Partial<Record<
  'agency_name' | 'description' | 'address' | 'city' | 'country' | 'phone' | 'whatsapp' | 'email' | 'opening_hours',
  string
>>;

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

export default function AboutPage() {
  const [content, setContent] = useState<PageContentRow[]>([]);
  const [agency, setAgency] = useState<AgencyInfo>({});
  const [agencyLoaded, setAgencyLoaded] = useState(false);
  const [team, setTeam] = useState<MorshidRow[]>([]);
  const [stats, setStats] = useState({ programs: 0, hotels: 0, rating: 0, reviews: 0 });

  useEffect(() => {
    publicList<PageContentRow>('content').then(setContent);
    publicList<MorshidRow>('staff').then(setTeam);
    publicAgency().then((a) => {
      setAgency((a || {}) as AgencyInfo);
      setAgencyLoaded(true);
    });
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

  const name = agency.agency_name || 'وكالة ساوث ستريت';
  const about = readAboutContent(content);
  const hero = { ...about.hero, text: about.hero.text || agency.description || 'وكالة سياحة وأسفار متخصصة في رحلات العمرة والحج، نرافقكم من لحظة اختيار البرنامج حتى عودتكم سالمين، بتنظيم واضح ومرافقة دينية متخصصة.' };
  const story = about.story;

  const statCards = [
    { icon: CalendarCheck, value: stats.programs, text: String(stats.programs), label: 'برامج متاحة الآن' },
    { icon: BedDouble, value: stats.hotels, text: String(stats.hotels), label: 'فنادق شريكة' },
    { icon: Users, value: team.length, text: String(team.length), label: 'الطاقم والمرشدون' },
    { icon: Star, value: stats.rating, text: stats.rating.toFixed(1), label: stats.reviews ? `تقييم المعتمرين (${stats.reviews})` : 'تقييم المعتمرين' },
  ].filter((s) => s.value > 0);

  // Settings first; the official defaults until they load (or if they are empty).
  const phone = agency.phone || (agencyLoaded ? '' : AGENCY_PHONE);
  const address = joinAddress([
    agency.address || AGENCY_ADDRESS,
    agency.address ? agency.city : AGENCY_CITY,
    agency.country || AGENCY_COUNTRY,
  ]);
  const details = [
    { icon: MapPin, label: 'العنوان', value: address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, ltr: false },
    phone && { icon: Phone, label: 'الهاتف', value: phone, href: telHref(phone), ltr: true },
    agency.email && { icon: Mail, label: 'البريد الإلكتروني', value: agency.email, href: `mailto:${agency.email}`, ltr: true },
    agency.opening_hours && { icon: Clock, label: 'أوقات العمل', value: agency.opening_hours, ltr: false },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; ltr: boolean }[];

  return (
    <div className="page-shell min-h-screen bg-white">
      <Navbar variant="light" />

      <main className="ip ip-about page-main" dir="rtl">
        {/* Hero */}
        <section className="ip-hero">
          <div className="ip-wrap ip-hero-grid">
            <div className="ip-reveal">
              <span className="ip-eyebrow"><BadgeCheck className="w-4 h-4" /> {name}</span>
              <h1>{hero.title}</h1>
              <p className="ip-lead">{hero.text}</p>
              <div className="ip-actions">
                <Link href="/packages" className="ip-btn is-primary">
                  تصفح البرامج <ArrowLeft className="w-4 h-4" />
                </Link>
                <a href="#contact" className="ip-btn is-ghost">تواصل معنا</a>
              </div>
              <ShareBar className="ip-share" text={`${name} — رحلات العمرة والحج`} />
            </div>
            <div className="ip-hero-art ip-reveal">
              <img src={hero.image} alt="المسجد الحرام" />
              <div className="ip-hero-badge">
                <span><HeartHandshake className="w-4 h-4" /></span>
                عمرة · حج · مرافقة دينية
              </div>
            </div>
          </div>
        </section>

        {about.settings.stats && statCards.length ? (
          <div className="ip-wrap">
            <div className="ip-stats ip-reveal">
              {statCards.map((s) => (
                <div key={s.label} className="ip-stat">
                  <i><s.icon className="w-5 h-5" /></i>
                  <div>
                    <b dir="ltr">{s.text}</b>
                    <small>{s.label}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Story */}
        <section className="ip-section">
          <div className="ip-wrap ip-story">
            <div className="ip-reveal">
              <span className="ip-eyebrow">قصتنا</span>
              <h2 className="ip-h2">{story.title}</h2>
              <p>{story.text}</p>
            </div>
            <div className="ip-story-img ip-reveal">
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
              <div className="ip-cards">
                {about.values.items.map((v, i) => {
                  const Icon = VALUE_ICONS[i % VALUE_ICONS.length];
                  return (
                    <article key={`${v.title}-${i}`} className="ip-card ip-reveal">
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
              <div className="ip-steps">
                {about.journey.items.map((s, i) => (
                  <div key={`${s.title}-${i}`} className="ip-step ip-reveal">
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                ))}
              </div>
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
                  <figure key={`${p.url}-${i}`} className="ip-photo ip-reveal">
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
                {team.map((m) => {
                  const photo = photoOf(m);
                  const rating = Number(m.rating) || 0;
                  const count = Number(m.reviewCount || m.review_count) || 0;
                  return (
                    <article key={m.morshid_id} className="ip-member ip-reveal">
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

        {/* Contact: two ways to get help, then the agency's details */}
        <section className="ip-section is-soft" id="contact">
          <div className="ip-wrap">
            <div className="ip-head ip-reveal">
              <span className="ip-eyebrow">تواصل معنا</span>
              <h2 className="ip-h2">نحن هنا لمساعدتكم</h2>
              <p className="ip-lead">جواب فوري من صخر، مساعدنا الذكي، أو حديث مباشر مع فريق الوكالة عبر تطبيق Connect.</p>
            </div>

            <div className="ip-help">
              <article className="ip-help-card is-sakhr ip-reveal">
                <div className="ip-help-top">
                  <span className="ip-help-mark is-sakhr" aria-hidden>ص</span>
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
                <button type="button" className="ip-btn is-sakhr" onClick={() => openSakhr()}>
                  <MessageCircle className="w-4 h-4" /> اسأل صخر الآن
                </button>
              </article>

              <article className="ip-help-card is-connect ip-reveal">
                <div className="ip-help-top">
                  <img className="ip-help-mark" src="/icons/connect-192.png" alt="" width={52} height={52} />
                  <div>
                    <h3>تطبيق South Street Connect</h3>
                    <small>فريق الوكالة</small>
                  </div>
                </div>
                <p>رسائل ومكالمات صوتية مباشرة مع مستشاري الوكالة ومرشدكم، من الهاتف أو الحاسوب.</p>
                <ul className="ip-help-points">
                  <li><MessageCircle className="w-4 h-4" aria-hidden /> رسائل</li>
                  <li><PhoneCall className="w-4 h-4" aria-hidden /> مكالمات صوتية</li>
                </ul>
                <div className="ip-help-actions">
                  <Link href="/app" className="ip-btn is-primary"><Download className="w-4 h-4" /> حمّل التطبيق</Link>
                  <Link href="/connect" className="ip-btn is-ghost">افتح Connect</Link>
                </div>
              </article>
            </div>

            <div className="ip-details ip-reveal">
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
                  <a key={d.label} href={d.href} className="ip-detail" target={d.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                    {body}
                  </a>
                ) : (
                  <div key={d.label} className="ip-detail">{body}</div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom call to action */}
        <section className="ip-section ip-end">
          <div className="ip-wrap">
            <div className="ip-band ip-reveal">
              <div>
                <h2>جاهزون لرحلتكم القادمة؟</h2>
                <p>اختاروا برنامجكم وأرسلوا طلبكم، وسنتواصل معكم لتأكيد كل التفاصيل.</p>
              </div>
              <div className="ip-band-actions">
                <Link href="/book" className="ip-btn is-light">احجز الآن <ArrowLeft className="w-4 h-4" /></Link>
                <Link href="/guide" className="ip-btn is-outline-light">دليل العمرة</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {agency.agency_name ? (
        <script
          type="application/ld+json"
          // Structured data so search engines show the agency's name, phone and address.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'TravelAgency',
              name: agency.agency_name,
              description: hero.text,
              url: typeof window !== 'undefined' ? window.location.origin : undefined,
              logo: typeof window !== 'undefined' ? `${window.location.origin}/images/south_street_logo_trans.png` : undefined,
              telephone: phone ? telHref(phone).slice(4) : undefined,
              email: agency.email,
              address: {
                '@type': 'PostalAddress',
                streetAddress: agency.address || AGENCY_ADDRESS,
                addressLocality: address.includes('الوادي') ? 'الوادي' : undefined,
                addressRegion: agency.address ? agency.city : AGENCY_CITY,
                addressCountry: 'DZ',
              },
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
