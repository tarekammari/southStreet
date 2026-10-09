'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, Table2, X } from 'lucide-react';
import type { VisualChart, VisualSpec } from '@/lib/sakhr/visual';

/**
 * Sakhr's visual reports: KPI tiles, animated SVG charts and a table, drawn
 * from the numbers the model got from tools. Inside the (dark) chat panel the
 * dark palette steps are used; the enlarged view and PNG exports are light.
 * Palette: the validated categorical order (blue, orange, aqua, yellow).
 */

type Theme = 'dark' | 'light';

const PALETTE: Record<Theme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500'],
};
const INK: Record<Theme, { text: string; muted: string; grid: string; surface: string }> = {
  light: { text: '#0f172a', muted: '#64748b', grid: '#e8eaee', surface: '#ffffff' },
  dark: { text: '#ececec', muted: '#9a9aa2', grid: 'rgba(255,255,255,0.08)', surface: '#1d1d20' },
};

function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.round(v * 100) / 100);
}
function full(v: number, unit?: string): string {
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/* ------------------------------------------------------------------ */
/* KPI tile with a count-up                                            */
/* ------------------------------------------------------------------ */

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setShown(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{Math.abs(value) >= 1000 ? Math.round(shown).toLocaleString('en-US') : Math.round(shown * 100) / 100}</>;
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

type Hover = { x: number; y: number; title: string; rows: { name: string; value: string; color: string }[] } | null;

function ChartSvg({ chart, theme, height, width = 640, svgRef }: { chart: VisualChart; theme: Theme; height: number; width?: number; svgRef?: React.Ref<SVGSVGElement> }) {
  const [hover, setHover] = useState<Hover>(null);
  const colors = PALETTE[theme];
  const ink = INK[theme];
  // The chat panel is narrow: a narrower drawing keeps text readable when scaled to fit.
  const W = width;
  const H = height;
  const pie = chart.type === 'pie' || chart.type === 'donut';
  const multi = chart.series.length > 1;

  const tip = (e: React.MouseEvent, i: number) => {
    const box = (e.currentTarget.closest('.skv-chart') as HTMLElement).getBoundingClientRect();
    setHover({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      title: chart.labels[i],
      rows: chart.series.map((s, si) => ({ name: s.name, value: full(s.values[i], chart.unit), color: colors[si % colors.length] })),
    });
  };

  let body: React.ReactNode;

  if (pie) {
    const values = chart.series[0].values;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(H, 260) / 2 - 10;
    const cx = W / 2;
    const cy = H / 2;
    const stroke = chart.type === 'donut' ? r * 0.36 : r;
    const radius = chart.type === 'donut' ? r - stroke / 2 : r / 2;
    let acc = 0;
    body = (
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {values.map((v, i) => {
          const share = (v / total) * 100;
          const seg = (
            <circle
              key={i}
              className="skv-slice"
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={stroke}
              pathLength={100}
              strokeDasharray={`${Math.max(0, share - 0.6)} ${100 - Math.max(0, share - 0.6)}`}
              strokeDashoffset={-acc}
              style={{ animationDelay: `${i * 90}ms` }}
              onMouseMove={(e) =>
                setHover({
                  x: e.clientX - (e.currentTarget.closest('.skv-chart') as HTMLElement).getBoundingClientRect().left,
                  y: e.clientY - (e.currentTarget.closest('.skv-chart') as HTMLElement).getBoundingClientRect().top,
                  title: chart.labels[i],
                  rows: [{ name: `${share.toFixed(1)}%`, value: full(v, chart.unit), color: colors[i % colors.length] }],
                })
              }
              onMouseLeave={() => setHover(null)}
            />
          );
          acc += share;
          return seg;
        })}
        {chart.type === 'donut' ? (
          <text x={cx} y={cy} transform={`rotate(90 ${cx} ${cy})`} textAnchor="middle" direction="ltr" dominantBaseline="middle" fill={ink.text} fontSize="22" fontWeight="800">
            {compact(total)}
          </text>
        ) : null}
      </g>
    );
  } else if (chart.type === 'hbar') {
    const labelW = Math.round(W * 0.3);
    const valW = 56;
    const rowH = Math.max(22, Math.min(34, (H - 10) / chart.labels.length));
    const max = niceMax(Math.max(...chart.series.flatMap((s) => s.values), 0));
    const track = W - labelW - valW;
    const barH = Math.max(6, (rowH - 8) / chart.series.length - 2);
    body = (
      <g>
        {chart.labels.map((label, i) => {
          const y = 6 + i * rowH;
          return (
            <g key={i} onMouseMove={(e) => tip(e, i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={y} width={W} height={rowH} fill="transparent" />
              <text x={W - 4} y={y + rowH / 2} textAnchor="start" direction="rtl" dominantBaseline="middle" fill={ink.text} fontSize="12.5">
                {label.length > 22 ? `${label.slice(0, 21)}…` : label}
              </text>
              {chart.series.map((s, si) => {
                const w = (Math.max(0, s.values[i]) / max) * track;
                const by = y + 4 + si * (barH + 2);
                const right = W - labelW;
                return (
                  <g key={si}>
                    <rect className="skv-hbar" x={right - w} y={by} width={Math.max(1, w)} height={barH} rx={Math.min(4, barH / 2)} fill={colors[si % colors.length]} style={{ animationDelay: `${i * 60}ms`, transformOrigin: `${right}px ${by}px` }} />
                    {!multi ? (
                      <text x={right - w - 6} y={by + barH / 2} textAnchor="end" direction="ltr" dominantBaseline="middle" fill={ink.muted} fontSize="11.5">
                        {compact(s.values[i])}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    );
  } else {
    const padL = 44;
    const padR = 10;
    const padT = 10;
    const padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const all = chart.series.flatMap((s) => s.values);
    const max = niceMax(Math.max(...all, 0));
    const min = Math.min(0, ...all);
    const span = max - min || 1;
    const yOf = (v: number) => padT + plotH - ((v - min) / span) * plotH;
    const n = chart.labels.length;
    const band = plotW / n;
    const xOf = (i: number) => padL + band * i + band / 2;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => min + span * k);
    const step = Math.ceil(n / 8); // at most ~8 x labels
    // Labels get as many characters as their slot can hold (~6.5 units per character).
    const maxChars = Math.max(5, Math.floor((band * step) / 6.5));

    const grid = (
      <g>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} stroke={ink.grid} strokeWidth={1} />
            <text x={padL - 6} y={yOf(t)} textAnchor="end" direction="ltr" dominantBaseline="middle" fill={ink.muted} fontSize="11">
              {compact(t)}
            </text>
          </g>
        ))}
        {chart.labels.map((l, i) =>
          i % step === 0 ? (
            <text key={i} x={xOf(i)} y={H - 10} textAnchor="middle" fill={ink.muted} fontSize="11">
              {l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l}
            </text>
          ) : null
        )}
      </g>
    );

    const hits = chart.labels.map((_, i) => (
      <rect key={i} x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" onMouseMove={(e) => tip(e, i)} onMouseLeave={() => setHover(null)} />
    ));

    if (chart.type === 'bar') {
      const groups = chart.series.length;
      const gap = 2;
      const barW = Math.max(4, Math.min(34, (band * 0.72 - gap * (groups - 1)) / groups));
      const base = yOf(0);
      body = (
        <g>
          {grid}
          {chart.labels.map((_, i) =>
            chart.series.map((s, si) => {
              const v = s.values[i];
              const x = xOf(i) - (groups * barW + gap * (groups - 1)) / 2 + si * (barW + gap);
              const y = v >= 0 ? yOf(v) : base;
              const h = Math.max(1, Math.abs(yOf(v) - base));
              const r = Math.min(4, barW / 2, h);
              // Rounded on the data end only, square on the baseline.
              const d = v >= 0
                ? `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${base} Z`
                : `M${x},${base} V${base + h - r} Q${x},${base + h} ${x + r},${base + h} H${x + barW - r} Q${x + barW},${base + h} ${x + barW},${base + h - r} V${base} Z`;
              return <path key={`${i}-${si}`} className="skv-bar" d={d} fill={colors[si % colors.length]} style={{ animationDelay: `${i * 45}ms`, transformOrigin: `${x}px ${base}px` }} />;
            })
          )}
          {hits}
        </g>
      );
    } else {
      body = (
        <g>
          {grid}
          {chart.series.map((s, si) => {
            const pts = s.values.map((v, i) => [xOf(i), yOf(v)] as const);
            const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
            const color = colors[si % colors.length];
            return (
              <g key={si}>
                {chart.type === 'area' ? (
                  <path className="skv-area" d={`${line} L${pts[pts.length - 1][0]},${yOf(Math.max(0, min))} L${pts[0][0]},${yOf(Math.max(0, min))} Z`} fill={color} opacity={multi ? 0.14 : 0.2} />
                ) : null}
                <path className="skv-line" d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} style={{ animationDelay: `${si * 150}ms` }} />
                {n <= 12
                  ? pts.map(([x, y], i) => <circle key={i} className="skv-dot" cx={x} cy={y} r={4} fill={color} stroke={ink.surface} strokeWidth={2} style={{ animationDelay: `${600 + i * 30}ms` }} />)
                  : null}
              </g>
            );
          })}
          {hits}
        </g>
      );
    }
  }

  return (
    <div className="skv-chart">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={chart.title} fontFamily="Tajawal, 'Segoe UI', Tahoma, sans-serif">
        {body}
      </svg>
      {hover ? (
        <div className="skv-tip" style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12 }}>
          <strong>{hover.title}</strong>
          {hover.rows.map((r) => (
            <span key={r.name}>
              <i style={{ background: r.color }} />
              {chart.series.length > 1 || pie ? `${r.name}: ` : ''}
              <b dir="ltr">{r.value}</b>
            </span>
          ))}
        </div>
      ) : null}
      {multi || pie ? (
        <div className="skv-legend">
          {(pie ? chart.labels : chart.series.map((s) => s.name)).map((name, i) => {
            const total = pie ? chart.series[0].values.reduce((a, b) => a + b, 0) || 1 : 0;
            return (
              <span key={name + i}>
                <i style={{ background: colors[i % colors.length] }} />
                {name}
                {pie ? <em dir="ltr">{((chart.series[0].values[i] / total) * 100).toFixed(0)}%</em> : null}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Light PNG of one chart, with its title, for sharing. */
function downloadPng(svg: SVGSVGElement | null, title: string) {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style')); // drop animation offsets
  const vb = svg.viewBox.baseVal;
  const scale = 2;
  const head = 54;
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = vb.width * scale;
    canvas.height = (vb.height + head) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, vb.width, vb.height + head);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Tajawal, "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText(title, vb.width - 16, 32);
    ctx.drawImage(img, 0, head, vb.width, vb.height);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) || 'chart'}.png`;
    a.click();
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

function VisualBody({ visual, theme, large }: { visual: VisualSpec; theme: Theme; large?: boolean }) {
  const [showTable, setShowTable] = useState(false);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  // Light exports need light colours: keep a hidden light copy of each chart for the PNG.
  const exportRefs = useRef<(SVGSVGElement | null)[]>([]);

  // Every chart can also be read as a table (accessibility + exact numbers).
  const derivedTable = useMemo(() => {
    if (visual.table) return visual.table;
    const c = visual.charts?.[0];
    if (!c) return undefined;
    return { columns: ['البند', ...c.series.map((s) => s.name)], rows: c.labels.map((l, i) => [l, ...c.series.map((s) => s.values[i])]) };
  }, [visual]);

  return (
    <div className={`skv is-${theme}${large ? ' is-large' : ''}`}>
      {visual.kpis?.length ? (
        <div className="skv-kpis">
          {visual.kpis.map((k, i) => (
            <div key={i} className="skv-kpi" style={{ animationDelay: `${i * 70}ms` }}>
              <span>{k.label}</span>
              <strong dir="ltr">
                {typeof k.value === 'number' ? <CountUp value={k.value} /> : k.value}
                {k.unit ? <small> {k.unit}</small> : null}
              </strong>
              {k.hint ? <em>{k.hint}</em> : null}
            </div>
          ))}
        </div>
      ) : null}

      {visual.charts?.map((c, i) => (
        <section key={i} className="skv-section">
          <header>
            <h4>{c.title}</h4>
            <button type="button" className="skv-mini" onClick={() => downloadPng(exportRefs.current[i] || svgRefs.current[i], c.title)} title="تنزيل صورة" aria-label="تنزيل صورة">
              <Download className="w-3.5 h-3.5" />
            </button>
          </header>
          <ChartSvg chart={c} theme={theme} width={large ? 860 : 420} height={c.type === 'hbar' ? Math.min(large ? 440 : 320, 20 + c.labels.length * (large ? 40 : 32)) : large ? 340 : 230} svgRef={(el) => { svgRefs.current[i] = el; }} />
          {theme === 'dark' ? (
            <div className="skv-export" aria-hidden>
              <ChartSvg chart={c} theme="light" height={c.type === 'hbar' ? Math.min(300, 20 + c.labels.length * 30) : 260} svgRef={(el) => { exportRefs.current[i] = el; }} />
            </div>
          ) : null}
        </section>
      ))}

      {derivedTable ? (
        visual.table || showTable ? (
          <div className="skv-table-wrap">
            <table className="skv-table">
              <thead>
                <tr>{derivedTable.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {derivedTable.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} dir={typeof cell === 'number' ? 'ltr' : undefined}>{typeof cell === 'number' ? cell.toLocaleString('en-US') : cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <button type="button" className="skv-link" onClick={() => setShowTable(true)}>
            <Table2 className="w-3.5 h-3.5" /> عرض الأرقام كجدول
          </button>
        )
      ) : null}

      {visual.note ? <p className="skv-note">{visual.note}</p> : null}
    </div>
  );
}

export default function SakhrVisual({ visual }: { visual: VisualSpec }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <>
      <div className="skv-card">
        <div className="skv-head">
          <div>
            <strong>{visual.title}</strong>
            {visual.subtitle ? <span>{visual.subtitle}</span> : null}
          </div>
          <button type="button" className="skv-mini" onClick={() => setExpanded(true)} title="فتح في نافذة مستقلة" aria-label="فتح في نافذة مستقلة">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <VisualBody visual={visual} theme="dark" />
      </div>

      {expanded ? (
        <div className="skv-overlay" role="dialog" aria-modal="true" aria-label={visual.title} dir="rtl" onClick={() => setExpanded(false)}>
          <div className="skv-window" onClick={(e) => e.stopPropagation()}>
            <header className="skv-window-head">
              <div>
                <h3>{visual.title}</h3>
                {visual.subtitle ? <p>{visual.subtitle}</p> : null}
              </div>
              <button type="button" className="skv-close" onClick={() => setExpanded(false)} aria-label="إغلاق">
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="skv-window-body">
              <VisualBody visual={visual} theme="light" large />
            </div>
            <footer className="skv-window-foot">صخر · بيانات الوكالة الحالية</footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
