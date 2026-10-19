'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { parseTripDate } from '@/lib/booking-catalog';
import { PageContentRow, pickPageContent } from '@/lib/page-content';
import { isBookable, programAvailability } from '@/lib/program-display';
import ProgramCard from '@/components/ProgramCard';
import { DESTINATIONS, isTourism, parseTour } from '@/lib/tour';

// Older CMS titles that no longer fit this section fall back to the default.
const STALE_TITLES = new Set(['اختر رحلتك القادمة', 'مواعيد الانطلاق']);
const DEFAULT_TITLE = 'البرامج القادمة';

/** The booking flow in four words, in the order the agency processes it. */
const STEPS = ['اختر برنامجك', 'موافقة الوكالة', 'دفع العربون', 'حجز مؤكد'];

/**
 * Home rail: `religious` = Umrah / Hajj (CMS title), `tourism` = organised
 * tourist trips with the destinations on sale. Each kind links to its own page.
 */
export default function TravelProgramsSection({ content, kind = 'religious' }: { content?: PageContentRow[]; kind?: 'religious' | 'tourism' }) {
  const [programs, setPrograms] = useState<Package[] | null>(null);
  const [destIds, setDestIds] = useState<string[]>([]);
  const copy = pickPageContent(content, 'programs_section', { title: DEFAULT_TITLE });
  const tourism = kind === 'tourism';
  const title = tourism ? 'رحلات سياحية منظّمة' : STALE_TITLES.has(copy.title) ? DEFAULT_TITLE : copy.title;

  useEffect(() => {
    let cancelled = false;
    publicList<Package>('packages')
      .then((data) => {
        if (cancelled) return;
        const upcoming = data
          .filter((pkg) => programAvailability(pkg) !== 'expired')
          .filter((pkg) => isTourism(pkg) === tourism)
          .sort((a, b) => {
            // Bookable first, then soonest departure.
            const ba = isBookable(programAvailability(a)) ? 0 : 1;
            const bb = isBookable(programAvailability(b)) ? 0 : 1;
            if (ba !== bb) return ba - bb;
            return (parseTripDate(a.start_date)?.getTime() ?? Infinity) - (parseTripDate(b.start_date)?.getTime() ?? Infinity);
          });
        setPrograms(upcoming.slice(0, 3));
        setDestIds([...new Set(upcoming.map((p) => parseTour(p.tour).country).filter(Boolean))]);
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tourism]);

  // No tourist trip published yet: the home page simply has no such section.
  if (tourism && programs !== null && programs.length === 0) return null;

  return (
    <motion.section
      id={tourism ? 'trips-section' : 'programs-section'}
      className={`prog-section${tourism ? ' is-tour' : ''}`}
      aria-labelledby={tourism ? 'trips-title' : 'programs-title'}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="prog-head">
        <div>
          <h2 id={tourism ? 'trips-title' : 'programs-title'}>{title}</h2>
          {tourism ? <p className="prog-lead">برنامج يوماً بيوم، فنادق مختارة، والوكالة تتكفّل بالتأشيرة.</p> : null}
        </div>
        <Link href={tourism ? '/trips' : '/packages'} className="prog-all">
          {tourism ? 'كل الرحلات' : 'كل البرامج'}
          <ArrowLeft className="w-4 h-4" aria-hidden />
        </Link>
      </header>

      {tourism ? (
        <div className="prog-dests" aria-label="الوجهات">
          {DESTINATIONS.map((d) => (
            <Link key={d.id} href="/trips" className={destIds.includes(d.id) ? 'is-live' : ''}>
              <i style={{ background: d.color }} aria-hidden />
              {d.label}
            </Link>
          ))}
        </div>
      ) : null}

      {programs === null ? (
        <div className="prog-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="prog-card is-skeleton" />)}
        </div>
      ) : programs.length === 0 ? (
        <p className="prog-empty">لا توجد برامج معلنة حالياً.</p>
      ) : (
        <div className="prog-grid">
          {programs.map((pkg, index) => (
            <motion.div
              key={pkg.package_id}
              className="prog-cell"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProgramCard pkg={pkg} index={index} />
            </motion.div>
          ))}
        </div>
      )}

      {tourism ? null : (
      <ol className="prog-steps" aria-label="خطوات الحجز">
        {STEPS.map((step, i) => (
          <li key={step}>
            <span className="prog-step-n">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      )}
    </motion.section>
  );
}
