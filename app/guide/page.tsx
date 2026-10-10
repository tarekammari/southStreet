'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Info,
  Lightbulb,
  Printer,
  RotateCw,
  XCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import UmrahCounter from '@/components/UmrahCounter';
import { useReveal } from '@/components/info/useReveal';
import { CHECKLIST, FAQ, SECTIONS } from '@/components/info/guideContent';
import '@/app/info-pages.css';

const CHECK_KEY = 'ss_guide_checklist';

const TOC = [
  { id: 'prepare', title: 'قبل السفر' },
  ...SECTIONS.slice(0, 4).map((s) => ({ id: s.id, title: s.title })),
  { id: 'counter', title: 'عدّاد الأشواط' },
  ...SECTIONS.slice(4).map((s) => ({ id: s.id, title: s.title })),
  { id: 'faq', title: 'أسئلة شائعة' },
];

function DuaBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ip-dua">
      <small>
        {label}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
          aria-label="نسخ الدعاء"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      </small>
      <blockquote>{text}</blockquote>
    </div>
  );
}

export default function GuidePage() {
  const [active, setActive] = useState(TOC[0].id);
  const [done, setDone] = useState<string[]>([]);

  useReveal();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHECK_KEY) || '[]');
      if (Array.isArray(saved)) setDone(saved.filter((x) => CHECKLIST.includes(x)));
    } catch {
      /* start empty */
    }
  }, []);

  const toggle = (item: string) => {
    setDone((prev) => {
      const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
      try {
        localStorage.setItem(CHECK_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Highlight the section being read in the table of contents.
  useEffect(() => {
    const els = TOC.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -60% 0px', threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Keep the active item visible in the horizontal menu on phones.
  useEffect(() => {
    document.querySelector(`.ip-toc a[href="#${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  const progress = useMemo(() => Math.round((done.length / CHECKLIST.length) * 100), [done]);
  const readIndex = TOC.findIndex((t) => t.id === active);

  const renderSection = (s: (typeof SECTIONS)[number], number: number) => (
    <section key={s.id} id={s.id} className="ip-gsec ip-reveal">
      <div className="ip-gsec-head">
        <span className="ip-gsec-num">{number}</span>
        <div>
          <h2>{s.title}</h2>
          <small>{s.subtitle}</small>
        </div>
      </div>
      <p>{s.intro}</p>
      {s.steps ? (
        <ul className="ip-list">
          {s.steps.map((step) => (
            <li key={step}><CheckCircle2 className="w-4 h-4" /> <span>{step}</span></li>
          ))}
        </ul>
      ) : null}
      {s.warn ? (
        <ul className="ip-list is-warn">
          {s.warn.map((w) => (
            <li key={w}><XCircle className="w-4 h-4" /> <span>{w}</span></li>
          ))}
        </ul>
      ) : null}
      {s.dua ? <DuaBox label={s.dua.label} text={s.dua.text} /> : null}
      {s.boxes ? (
        <div className="ip-split">
          {s.boxes.map((b) => (
            <div key={b.title} className="ip-box">
              <h4><Info className="w-4 h-4 text-emerald-700" /> {b.title}</h4>
              <ul className="ip-list" style={{ margin: 0 }}>
                {b.items.map((it) => (
                  <li key={it}><Check className="w-4 h-4" /> <span>{it}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {s.tip ? (
        <div className="ip-tip"><Lightbulb className="w-4 h-4" /> <span>{s.tip}</span></div>
      ) : null}
    </section>
  );

  return (
    <div className="page-shell min-h-screen bg-white">
      <Navbar variant="light" />

      <main className="ip page-main" dir="rtl">
        <section className="ip-hero">
          <div className="ip-wrap ip-hero-grid">
            <div className="ip-reveal">
              <span className="ip-eyebrow">دليل المعتمر</span>
              <h1>العمرة <em>خطوة بخطوة</em></h1>
              <p className="ip-lead">
                دليل مبسّط وواضح من التحضير للسفر حتى التحلل من الإحرام، مع الأدعية وقائمة تجهيز تفاعلية وعدّاد للأشواط تستعمله في الحرم.
              </p>
              <div className="ip-chips">
                <span className="ip-chip"><RotateCw className="w-3.5 h-3.5" /> 7 أشواط طواف</span>
                <span className="ip-chip"><RotateCw className="w-3.5 h-3.5" /> 7 أشواط سعي</span>
                <span className="ip-chip"><CheckCircle2 className="w-3.5 h-3.5" /> الحلق أو التقصير</span>
              </div>
              <div className="ip-actions">
                <a href="#prepare" className="ip-btn is-primary">ابدأ القراءة <ArrowLeft className="w-4 h-4" /></a>
                <Link href="/packages" className="ip-btn is-ghost">برامج العمرة</Link>
              </div>
            </div>
            <div className="ip-hero-art ip-reveal">
              <img src="/images/kaaba_sharifa_home_page.webp" alt="الكعبة المشرفة" />
              <div className="ip-hero-badge">
                <span><CheckCircle2 className="w-4 h-4" /></span>
                الإحرام · الطواف · السعي · التقصير
              </div>
            </div>
          </div>
        </section>

        <section className="ip-section">
          <div className="ip-wrap ip-guide">
            <nav className="ip-toc" aria-label="محتويات الدليل">
              <span className="ip-toc-title">محتويات الدليل</span>
              {TOC.map((t, i) => (
                <a key={t.id} href={`#${t.id}`} className={active === t.id ? 'is-on' : undefined}>
                  <span>{i + 1}</span>
                  {t.title}
                </a>
              ))}
              <div className="ip-toc-progress" aria-hidden>
                <i style={{ width: `${Math.round(((readIndex + 1) / TOC.length) * 100)}%` }} />
              </div>
            </nav>

            <div>
              {/* 1. Preparation checklist */}
              <section id="prepare" className="ip-gsec ip-reveal">
                <div className="ip-gsec-head">
                  <span className="ip-gsec-num">1</span>
                  <div>
                    <h2>قبل السفر</h2>
                    <small>قائمة التجهيز: علّم ما جهّزته، ويُحفظ على جهازك</small>
                  </div>
                </div>
                <div className="ip-check-head">
                  <div className="ip-check-bar" aria-hidden><i style={{ width: `${progress}%` }} /></div>
                  <b>{done.length} / {CHECKLIST.length}</b>
                  <button type="button" className="ip-btn is-ghost" style={{ padding: '8px 14px' }} onClick={() => window.print()}>
                    <Printer className="w-4 h-4" /> طباعة الدليل
                  </button>
                </div>
                <div className="ip-checks">
                  {CHECKLIST.map((item) => {
                    const on = done.includes(item);
                    return (
                      <label key={item} className={on ? 'is-done' : undefined}>
                        <input type="checkbox" checked={on} onChange={() => toggle(item)} />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
                {progress === 100 ? (
                  <div className="ip-tip"><CheckCircle2 className="w-4 h-4" /> <span>أحسنت! كل شيء جاهز. نسأل الله لك رحلة ميسّرة وعمرة مقبولة.</span></div>
                ) : null}
              </section>

              {SECTIONS.slice(0, 4).map((s, i) => renderSection(s, i + 2))}

              <section id="counter" className="ip-gsec ip-reveal">
                <div className="ip-gsec-head">
                  <span className="ip-gsec-num">{6}</span>
                  <div>
                    <h2>عدّاد الأشواط</h2>
                    <small>استعمله على هاتفك أثناء الطواف والسعي حتى لا تنسى العدد</small>
                  </div>
                </div>
                <UmrahCounter />
                <div className="ip-note"><Info className="w-4 h-4 flex-none mt-1" /> الأدعية المعروضة في العدّاد اقتراحات، ويجوز الدعاء بما تشاء.</div>
              </section>

              {SECTIONS.slice(4).map((s, i) => renderSection(s, i + 7))}

              <section id="faq" className="ip-gsec ip-reveal">
                <div className="ip-gsec-head">
                  <span className="ip-gsec-num">{TOC.length}</span>
                  <div>
                    <h2>أسئلة شائعة</h2>
                    <small>أجوبة مختصرة عن أكثر ما يسأل عنه المعتمرون</small>
                  </div>
                </div>
                <div className="ip-faq">
                  {FAQ.map((f) => (
                    <details key={f.q}>
                      <summary>{f.q} <ChevronDown className="w-4 h-4" /></summary>
                      <div>{f.a}</div>
                    </details>
                  ))}
                </div>
                <div className="ip-note">
                  <AlertTriangle className="w-4 h-4 flex-none mt-1 text-amber-600" />
                  هذا الدليل تبسيط للخطوات المتفق عليها. للتفاصيل الفقهية والحالات الخاصة اسأل مرشد الوكالة، أو اسأل صخر في أي وقت.
                </div>
              </section>

              <div className="ip-cta ip-reveal" style={{ marginTop: 8 }}>
                <div>
                  <h3>جاهز لأداء العمرة؟</h3>
                  <p>اختر برنامجك وسيرافقك مرشدونا في كل خطوة من هذا الدليل.</p>
                </div>
                <div className="ip-actions" style={{ marginTop: 0 }}>
                  <Link href="/book" className="ip-btn is-light">احجز الآن <ArrowLeft className="w-4 h-4" /></Link>
                  <Link href="/about" className="ip-btn is-ghost">تعرّف على الوكالة</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <SakhrAgent />
    </div>
  );
}
