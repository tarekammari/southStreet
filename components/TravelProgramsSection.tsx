'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchJsonList } from '@/lib/fetch-json';
import { PageContentRow, pickPageContent } from '@/lib/page-content';

type Program = {
  id: string;
  title: string;
  date: string;
  duration: string;
  departure: string;
  priceTag?: string;
  state: 'available' | 'upcoming';
  badgeText: string;
};

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

function lowestPrice(prices: { amount?: number }[] | undefined): string | undefined {
  if (!Array.isArray(prices) || prices.length === 0) return undefined;
  const amounts = prices.map((p) => Number(p.amount)).filter((n) => Number.isFinite(n) && n > 0);
  if (amounts.length === 0) return undefined;
  return `من ${Math.min(...amounts).toLocaleString('ar-DZ')} دج`;
}

function isAvailablePackage(pkg: { status?: string; published?: boolean }): boolean {
  const status = String(pkg.status || '').toUpperCase();
  if (status === 'UPCOMING' || status === 'DRAFT' || status === 'CLOSED') return false;
  return pkg.published !== false && (status === 'PUBLISHED' || status === 'OPEN' || status === 'CURRENT' || !status);
}

export default function TravelProgramsSection({ content }: { content?: PageContentRow[] }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const programsCopy = pickPageContent(content, 'programs_section', {
    title: 'اختر رحلتك القادمة',
    content: 'برامج العمرة والحج المتاحة للحجز، والرحلات القادمة للتسجيل المسبق.',
  });

  useEffect(() => {
    let cancelled = false;
    fetchJsonList<any>('/api/admin/packages')
      .then((data) => {
        if (cancelled) return;
        const mapped: Program[] = data.map((pkg: any) => {
          const available = isAvailablePackage(pkg);
          return {
            id: pkg.package_id,
            title: pkg.name,
            date: formatDate(pkg.start_date) || pkg.season_name || '',
            duration: pkg.duration_days ? `${pkg.duration_days} يوماً` : '',
            departure: [pkg.airline, pkg.departure_city].filter(Boolean).join(' — '),
            priceTag: lowestPrice(pkg.prices),
            state: available ? 'available' : 'upcoming',
            badgeText: available ? 'متاح للحجز الآن' : 'قريباً — افتتح التسجيل',
          };
        });
        const ordered = [
          ...mapped.filter((p) => p.state === 'available'),
          ...mapped.filter((p) => p.state === 'upcoming'),
        ];
        setPrograms(ordered);
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <motion.section
      id="programs-section"
      className="travel-faq-section"
      aria-label="برامج السفر"
      initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="travel-faq-heading">{programsCopy.title}</h2>
      <p className="travel-faq-lead">
        {programsCopy.content}
      </p>

      <motion.div
        className="travel-faq-list"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
        }}
      >
        {programs.length === 0 ? (
          <p className="travel-faq-empty">لا توجد رحلات مسجّلة في الجدول حالياً.</p>
        ) : (
          programs.map((prog) => {
            const open = openId === prog.id;
            const panelId = `travel-panel-${prog.id}`;
            return (
              <motion.div
                key={prog.id}
                className="travel-faq-item"
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <button
                  type="button"
                  className="travel-faq-trigger"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(prog.id)}
                >
                  <span className="travel-faq-title">{prog.title}</span>
                  <Plus className={`travel-faq-plus${open ? ' is-open' : ''}`} strokeWidth={1.6} />
                </button>
                <motion.div
                  id={panelId}
                  className="travel-faq-panel"
                  role="region"
                  aria-hidden={!open}
                  initial={false}
                  animate={{
                    height: open ? 'auto' : 0,
                    opacity: open ? 1 : 0,
                  }}
                  transition={{
                    height: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.32, ease: 'easeOut' },
                  }}
                >
                  <div className="travel-faq-panel-inner">
                    <p className="travel-faq-badge">{prog.badgeText}</p>
                    <ul className="travel-faq-meta">
                      {prog.date ? <li>{prog.date}</li> : null}
                      {prog.duration ? <li>{prog.duration}</li> : null}
                      {prog.departure ? <li>{prog.departure}</li> : null}
                      <li>{prog.priceTag || 'السعر عند الطلب'}</li>
                    </ul>
                    <a href={prog.state === 'available' ? `/book?package=${encodeURIComponent(prog.id)}` : '/packages'} className="travel-faq-link" tabIndex={open ? 0 : -1}>
                      {prog.state === 'available' ? 'اطلب الحجز المباشر' : 'سجّل اهتمامك'}
                    </a>
                  </div>
                </motion.div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </motion.section>
  );
}
