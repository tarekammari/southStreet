export type ActivityWeek = {
  days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[];
};

function levelOf(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/** Last 53 weeks, Sunday-first columns, for a contribution heatmap. */
export function buildActivityWeeks(counts: Record<string, number>, weekCount = 53): ActivityWeek[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 7) % 7) - (weekCount - 1) * 7);

  const values = Object.values(counts);
  const max = values.length ? Math.max(...values) : 0;
  const weeks: ActivityWeek[] = [];

  for (let w = 0; w < weekCount; w += 1) {
    const days: ActivityWeek['days'] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      const count = counts[key] || 0;
      days.push({ date: key, count, level: levelOf(count, max) });
    }
    weeks.push({ days });
  }
  return weeks;
}
