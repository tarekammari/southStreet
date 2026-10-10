'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  CalendarCheck,
  Clock,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import TestimonialsSection from '@/components/TestimonialsSection';
import { initialOf, photoOf, type MorshidRow } from '@/components/AboutSection';
import { useReveal } from '@/components/info/useReveal';
import { fetchJsonList } from '@/lib/fetch-json';
import { PageContentRow, pickPageContent } from '@/lib/page-content';
import '@/app/info-pages.css';

type AgencyInfo = Partial<Record<
  'agency_name' | 'description' | 'address' | 'city' | 'country' | 'phone' | 'whatsapp' | 'email' | 'opening_hours',
  string
>>;

const VALUES = [
  { icon: HeartHandshake, title: 'مرافقة دينية متخصصة', text: 'مرشدون ومرشدات يرافقونكم في المناسك خطوة بخطوة، ويجيبون عن أسئلتكم طوال الرحلة.' },
  { icon: BedDouble, title: 'فنادق قريبة من الحرم', text: 'نختار فنادق موثوقة في مكة المكرمة والمدينة المنورة، مع توضيح المسافة والخدمات لكل فندق.' },
  { icon: ReceiptText, title: 'أسعار واضحة', text: 'سعر كل برنامج ونوع غرفة معروض بوضوح، وتحصلون على وصل وفاتورة لكل دفعة.' },
  { icon: ShieldCheck, title: 'متابعة قبل وأثناء الرحلة', text: 'نتابع وثائقكم وتأشيرتكم وحالة حجزكم، وتصلكم كل التحديثات في بوابتكم الخاصة.' },
];

const JOURNEY = [
  { title: 'اختر برنامجك', text: 'تصفح البرامج المتاحة وقارن التواريخ والفنادق والأسعار.' },
  { title: 'أرسل طلب الحجز', text: 'املأ طلبك عبر الموقع في دقائق، أو اطلب المساعدة من صخر.' },
  { title: 'التأكيد والوثائق', text: 'تراجع الوكالة طلبك، وتتابع معك الوثائق والتأشيرة والدفع.' },
  { title: 'السفر مع المرشد', text: 'رحلة منظمة من المطار إلى الفندق مع مرافقة في أداء المناسك.' },
  { title: 'العودة والتقييم', text: 'شاركنا تجربتك لتساعد المعتمرين القادمين في اختيارهم.' },
];

function whatsappHref(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').replace(/^00/, '');
  return `https://wa.me/${digits}`;
}

export default function AboutPage() {
  const [content, setContent] = useState<PageContentRow[]>([]);
  const [agency, setAgency] = useState<AgencyInfo>({});
  const [team, setTeam] = useState<MorshidRow[]>([]);
  const [stats, setStats] = useState({ programs: 0, hotels: 0, rating: 0, reviews: 0 });

  useEffect(() => {
    fetchJsonList<PageContentRow>('/api/admin/content').then(setContent);
    fetchJsonList<MorshidRow>('/api/admin/morshids').then(setTeam);
    fetch('/api/agency-info', { cache: 'no-store' }).then((r) => r.json()).then(setAgency).catch(() => undefined);
    Promise.all([
      fetchJsonList<unknown>('/api/admin/packages'),
      fetchJsonList<unknown>('/api/admin/hotels?site=1'),
      fetch('/api/reviews?targetType=agency&targetId=main&limit=1').then((r) => r.json()).catch(() => ({})),
    ]).then(([programs, hotels, reviews]) => {
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
  const hero = pickPageContent(content, 'about_hero', {
    title: 'رفيقكم الأمين في رحلة العمر',
    content:
      agency.description ||
      'وكالة سياحة وأسفار متخصصة في رحلات العمرة والحج، نرافقكم من لحظة اختيار البرنامج حتى عودتكم سالمين، بتنظيم واضح ومرافقة دينية متخصصة.',
    image: '/images/maka01.webp',
  });
  const story = pickPageContent(content, 'about_story', {
    title: 'من نحن',
    content:
      'نؤمن أن رحلة العمرة ليست سفراً عادياً، بل لحظة ينتظرها المسلم طويلاً. لذلك نهتم بكل تفصيلة: اختيار الفندق، وتنظيم التنقلات، ومرافقة المرشد، وتيسير الوثائق، حتى تتفرغوا للعبادة بقلب مطمئن.\n\nفريقنا يجمع إداريين ومرشدين ومرشدات ذوي خبرة، يعملون معاً ليكون كل معتمر في أيدٍ أمينة من الجزائر إلى الحرمين الشريفين.',
    image: '/images/section2_03.webp',
  });

  const statCards = [
    { icon: CalendarCheck, value: stats.programs, label: 'برامج متاحة الآن' },
    { icon: BedDouble, value: stats.hotels, label: 'فنادق شريكة' },
    { icon: Users, value: team.length, label: 'أعضاء الطاقم والمرشدين' },
    { icon: Star, value: stats.rating, label: stats.reviews ? `تقييم المعتمرين (${stats.reviews})` : 'تقييم المعتمرين' },
  ].filter((s) => s.value > 0);

  // The city is often already part of the address: don't repeat it.
  const address =
    agency.city && !(agency.address || '').includes(agency.city)
      ? [agency.address, agency.city].filter(Boolean).join('، ')
      : agency.address || agency.city || '';
  const contacts = [
    agency.phone && { icon: Phone, label: 'الهاتف', value: agency.phone, href: `tel:${agency.phone.replace(/\s+/g, '')}` },
    agency.whatsapp && { icon: MessageCircle, label: 'واتساب', value: agency.whatsapp, href: whatsappHref(agency.whatsapp) },
    agency.email && { icon: Mail, label: 'البريد الإلكتروني', value: agency.email, href: `mailto:${agency.email}` },
    address && { icon: MapPin, label: 'العنوان', value: address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` },
    agency.opening_hours && { icon: Clock, label: 'أوقات العمل', value: agency.opening_hours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  return (
    <div className="page-shell min-h-screen bg-white">
      <Navbar variant="light" />

      <main className="ip page-main" dir="rtl">
        {/* Hero */}
        <section className="ip-hero">
          <div className="ip-wrap ip-hero-grid">
            <div className="ip-reveal">
              <span className="ip-eyebrow"><BadgeCheck className="w-4 h-4" /> {name}</span>
              <h1>{hero.title}</h1>
              <p className="ip-lead">{hero.content}</p>
              <div className="ip-actions">
                <Link href="/packages" className="ip-btn is-primary">
                  تصفح البرامج <ArrowLeft className="w-4 h-4" />
                </Link>
                <a href="#contact" className="ip-btn is-ghost">تواصل معنا</a>
              </div>
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

        {statCards.length ? (
          <div className="ip-wrap">
            <div className="ip-stats">
              {statCards.map((s) => (
                <div key={s.label} className="ip-stat ip-reveal">
                  <i><s.icon className="w-5 h-5" /></i>
                  <b dir="ltr">{s.value}</b>
                  <small>{s.label}</small>
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
              <p>{story.content}</p>
            </div>
            <div className="ip-story-img ip-reveal">
              <img src={story.image} alt="" loading="lazy" />
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="ip-section is-soft">
          <div className="ip-wrap">
            <div className="ip-head ip-reveal">
              <span className="ip-eyebrow">لماذا نحن</span>
              <h2 className="ip-h2">ما يميّز رحلتكم معنا</h2>
            </div>
            <div className="ip-cards">
              {VALUES.map((v) => (
                <article key={v.title} className="ip-card ip-reveal">
                  <i><v.icon className="w-5 h-5" /></i>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="ip-section">
          <div className="ip-wrap">
            <div className="ip-head ip-reveal">
              <span className="ip-eyebrow">كيف نعمل</span>
              <h2 className="ip-h2">من الحجز إلى العودة</h2>
              <p className="ip-lead">خمس خطوات واضحة، ونحن معكم في كل واحدة منها.</p>
            </div>
            <div className="ip-steps">
              {JOURNEY.map((s) => (
                <div key={s.title} className="ip-step ip-reveal">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        {team.length ? (
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
                        {m.specialization ? <p>{m.specialization}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {/* Reviews (existing component, shows only approved reviews) */}
        <TestimonialsSection />

        {/* Contact */}
        <section className="ip-section" id="contact">
          <div className="ip-wrap">
            <div className="ip-head ip-reveal">
              <span className="ip-eyebrow">تواصل معنا</span>
              <h2 className="ip-h2">نحن هنا لمساعدتكم</h2>
            </div>
            <div className="ip-contact">
              <div className="ip-contact-list">
                {contacts.map((c) =>
                  c.href ? (
                    <a key={c.label} href={c.href} className="ip-contact-item ip-reveal" target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                      <i><c.icon className="w-5 h-5" /></i>
                      <div><small>{c.label}</small><b dir={c.label === 'العنوان' || c.label === 'أوقات العمل' ? undefined : 'ltr'}>{c.value}</b></div>
                    </a>
                  ) : (
                    <div key={c.label} className="ip-contact-item ip-reveal">
                      <i><c.icon className="w-5 h-5" /></i>
                      <div><small>{c.label}</small><b>{c.value}</b></div>
                    </div>
                  )
                )}
              </div>
              <div className="ip-cta ip-reveal">
                <div>
                  <h3>جاهزون لرحلتكم القادمة؟</h3>
                  <p>اختاروا برنامجكم وأرسلوا طلبكم الآن، وسنتواصل معكم لتأكيد كل التفاصيل. يمكنكم أيضاً سؤال صخر، مساعدنا الذكي، في أي وقت.</p>
                </div>
                <div className="ip-actions" style={{ marginTop: 0 }}>
                  <Link href="/book" className="ip-btn is-light">احجز الآن <ArrowLeft className="w-4 h-4" /></Link>
                  <Link href="/guide" className="ip-btn is-ghost">دليل العمرة</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer content={content} />
      <SakhrAgent />
    </div>
  );
}
