/**
 * Visual reports Sakhr can put in the chat: KPI tiles, charts and a table.
 * The model only sends data; the browser draws it (components/sakhr/SakhrVisual).
 * Everything is clamped here so a model mistake cannot produce a huge or broken card.
 */

export type ChartType = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'donut';

export type VisualKpi = { label: string; value: number | string; unit?: string; hint?: string };
export type VisualSeries = { name: string; values: number[] };
export type VisualChart = { type: ChartType; title: string; unit?: string; labels: string[]; series: VisualSeries[] };
export type VisualTable = { columns: string[]; rows: (string | number)[][] };
export type VisualSpec = {
  title: string;
  subtitle?: string;
  kpis?: VisualKpi[];
  charts?: VisualChart[];
  table?: VisualTable;
  note?: string;
};

const TYPES: ChartType[] = ['bar', 'hbar', 'line', 'area', 'pie', 'donut'];
const MAX_POINTS = 24;
const MAX_SERIES = 4; // the categorical palette is validated for small series counts

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function sanitizeVisual(input: any): VisualSpec | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Empty visual.' };
  const title = text(input.title, 90);
  if (!title) return { error: 'A visual needs a title.' };

  const kpis = (Array.isArray(input.kpis) ? input.kpis : []).slice(0, 6).map((k: any) => ({
    label: text(k?.label, 40),
    value: typeof k?.value === 'number' ? k.value : text(k?.value, 24),
    unit: text(k?.unit, 12) || undefined,
    hint: text(k?.hint, 50) || undefined,
  })).filter((k: VisualKpi) => k.label);

  const charts: VisualChart[] = [];
  for (const c of (Array.isArray(input.charts) ? input.charts : []).slice(0, 3)) {
    const type = TYPES.includes(c?.type) ? c.type : 'bar';
    const labels = (Array.isArray(c?.labels) ? c.labels : []).slice(0, MAX_POINTS).map((l: unknown) => text(l, 28));
    if (!labels.length) continue;
    const pie = type === 'pie' || type === 'donut';
    const series = (Array.isArray(c?.series) ? c.series : [])
      .slice(0, pie ? 1 : MAX_SERIES)
      .map((s: any) => ({
        name: text(s?.name, 30) || 'القيمة',
        values: labels.map((_: string, i: number) => num(Array.isArray(s?.values) ? s.values[i] : 0)),
      }));
    if (!series.length) continue;
    // Pie / donut: parts of a whole — negative slices make no sense.
    if (pie) series[0].values = series[0].values.map((v: number) => Math.max(0, v));
    charts.push({ type, title: text(c?.title, 70) || title, unit: text(c?.unit, 12) || undefined, labels, series });
  }

  let table: VisualTable | undefined;
  if (input.table && Array.isArray(input.table.columns) && Array.isArray(input.table.rows)) {
    const columns = input.table.columns.slice(0, 8).map((c: unknown) => text(c, 30));
    const rows = input.table.rows.slice(0, 40).map((r: unknown) =>
      columns.map((_: string, i: number) => {
        const cell = Array.isArray(r) ? r[i] : '';
        return typeof cell === 'number' && Number.isFinite(cell) ? cell : text(cell, 60);
      })
    );
    if (columns.length && rows.length) table = { columns, rows };
  }

  if (!kpis.length && !charts.length && !table) return { error: 'Give at least KPIs, a chart or a table.' };
  return {
    title,
    subtitle: text(input.subtitle, 120) || undefined,
    kpis: kpis.length ? kpis : undefined,
    charts: charts.length ? charts : undefined,
    table,
    note: text(input.note, 200) || undefined,
  };
}
