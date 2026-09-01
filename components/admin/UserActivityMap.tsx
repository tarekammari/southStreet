'use client';

import React, { useMemo } from 'react';
import { buildActivityWeeks, type ActivityWeek } from '@/lib/user-activity-map';

const DAY_LABELS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function monthLabels(weeks: ActivityWeek[]): { index: number; label: string }[] {
  const labels: { index: number; label: string }[] = [];
  let last = '';
  weeks.forEach((week, index) => {
    const date = new Date(`${week.days[0].date}T00:00:00`);
    const label = MONTHS_AR[date.getMonth()];
    if (label && label !== last) {
      labels.push({ index, label });
      last = label;
    }
  });
  return labels;
}

export default function UserActivityMap({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const weeks = useMemo(() => buildActivityWeeks(counts), [counts]);
  const months = useMemo(() => monthLabels(weeks), [weeks]);
  const total = useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts]);

  return (
    <section className="upm-heat" dir="ltr">
      <header className="upm-heat-head" dir="rtl">
        <h3>استخدام التطبيق</h3>
        <span>{total} نشاط خلال السنة</span>
      </header>
      <div className="upm-heat-scroll" style={{ ['--heat-weeks' as string]: String(weeks.length) }}>
        <div className="upm-heat-months">
          <span className="upm-heat-gutter" />
          {months.map((month) => (
            <span key={`${month.label}-${month.index}`} style={{ gridColumn: month.index + 2 }}>
              {month.label}
            </span>
          ))}
        </div>
        <div className="upm-heat-body">
          <div className="upm-heat-days" dir="rtl">
            {DAY_LABELS.map((label, i) => (
              <span key={label} className={i % 2 ? 'is-show' : ''}>{i % 2 ? label : ''}</span>
            ))}
          </div>
          <div className="upm-heat-grid">
            {weeks.map((week) => (
              <div key={week.days[0].date} className="upm-heat-week">
                {week.days.map((day) => (
                  <span
                    key={day.date}
                    className={`upm-heat-cell is-l${day.level}`}
                    title={`${day.date} — ${day.count} نشاط`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer className="upm-heat-legend" dir="rtl">
        أقل
        <span className="upm-heat-cell is-l0" />
        <span className="upm-heat-cell is-l1" />
        <span className="upm-heat-cell is-l2" />
        <span className="upm-heat-cell is-l3" />
        <span className="upm-heat-cell is-l4" />
        أكثر
      </footer>
    </section>
  );
}
