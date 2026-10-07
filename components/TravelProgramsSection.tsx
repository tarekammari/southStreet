'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Package } from '@/types';
import { fetchJsonList } from '@/lib/fetch-json';
import { parseTripDate } from '@/lib/booking-catalog';
import { PageContentRow, pickPageContent } from '@/lib/page-content';
import { isBookable, programAvailability } from '@/lib/program-display';
import ProgramCard from '@/components/ProgramCard';

// Older CMS titles that no longer fit this section fall back to the default.
const STALE_TITLES = new Set(['اختر رحلتك القادمة', 'مواعيد الانطلاق']);
const DEFAULT_TITLE = 'البرامج القادمة';

/** The booking flow in four words, in the order the agency processes it. */
const STEPS = ['اختر برنامجك', 'موافقة الوكالة', 'دفع العربون', 'حجز مؤكد'];

export default function TravelProgramsSection({ content }: { content?: PageContentRow[] }) {
  const [programs, setPrograms] = useState<Package[] | null>(null);
  const copy = pickPageContent(content, 'programs_section', { title: DEFAULT_TITLE });
  const title = STALE_TITLES.has(copy.title) ? DEFAULT_TITLE : copy.title;

  useEffect(() => {
    let cancelled = false;
    fetchJsonList<Package>('/api/admin/packages')
      .then((data) => {
        if (cancelled) return;
        const upcoming = data
          .filter((pkg) => programAvailability(pkg) !== 'expired')
          .sort((a, b) => {
            // Bookable first, then soonest departure.
            const ba = isBookable(programAvailability(a)) ? 0 : 1;
            const bb = isBookable(programAvailability(b)) ? 0 : 1;
            if (ba !== bb) return ba - bb;
            return (parseTripDate(a.start_date)?.getTime() ?? Infinity) - (parseTripDate(b.start_date)?.getTime() ?? Infinity);
          });
        setPrograms(upcoming.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.section
      id="programs-section"
      className="prog-section"
      aria-labelledby="programs-title"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="prog-head">
        <h2 id="programs-title">{title}</h2>
        <Link href="/packages" className="prog-all">
          كل البرامج
          <ArrowLeft className="w-4 h-4" aria-hidden />
        </Link>
      </header>

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

      <ol className="prog-steps" aria-label="خطوات الحجز">
        {STEPS.map((step, i) => (
          <li key={step}>
            <span className="prog-step-n">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
