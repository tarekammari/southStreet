#!/usr/bin/env tsx
/**
 * MIMO Performance Audit Script
 * Analyses the South Street app for performance issues.
 * Run: npx tsx mimo/scripts/perf-audit.ts
 * Output: mimo/reports/performance.md
 */

import fs from 'fs';
import path from 'path';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.join(APP_ROOT, 'mimo', 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'performance.md');

interface PerfFinding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
  title: string;
  file?: string;
  impact: string;
  fix: string;
  gain?: string;
  effort?: string;
}

const findings: PerfFinding[] = [];
let passCount = 0;

function find(id: string, severity: PerfFinding['severity'], title: string, impact: string, fix: string, file?: string, gain?: string, effort?: string) {
  if (severity === 'PASS') passCount++;
  else findings.push({ id, severity, title, file, impact, fix, gain, effort });
}

function readFile(relPath: string): string {
  const full = path.join(APP_ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf-8');
}

function fileSize(relPath: string): number {
  const full = path.join(APP_ROOT, relPath);
  if (!fs.existsSync(full)) return 0;
  return fs.statSync(full).size;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function countPattern(content: string, pattern: RegExp): number {
  return (content.match(pattern) || []).length;
}

console.log('⚡ MIMO Performance Audit starting...\n');

// ─── FILE SIZE ANALYSIS ───────────────────────────────────────────────────────

interface ComponentEntry {
  path: string;
  size: number;
  issues: string[];
}

const heavyComponents: ComponentEntry[] = [];
function scanComponents(dir: string) {
  const full = path.join(APP_ROOT, dir);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      scanComponents(relPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const size = fileSize(relPath);
      const content = readFile(relPath);
      const issues: string[] = [];

      if (size > 50_000) issues.push(`Large file (${formatBytes(size)}) — consider splitting`);
      if (size > 20_000 && !content.includes('React.memo') && !content.includes("'use client'") === false) {
        // Only flag client components
        if (content.includes("'use client'") && !content.includes('memo(') && !content.includes('React.memo')) {
          issues.push('Missing React.memo — may cause unnecessary re-renders');
        }
      }
      if (content.includes("'use client'") && size > 30_000) {
        issues.push(`Heavy client component (${formatBytes(size)}) — split or lazy load`);
      }

      if (size > 20_000) {
        heavyComponents.push({ path: relPath, size, issues });
      }
    }
  }
}

scanComponents('components');
scanComponents('app');

heavyComponents.sort((a, b) => b.size - a.size);

// Flag the top offenders
if (heavyComponents.length > 0) {
  const top = heavyComponents[0];
  if (top.size > 60_000) {
    find('SS-PERF-001', 'HIGH', `Extremely large component: ${path.basename(top.path)}`,
      `${formatBytes(top.size)} component impacts initial bundle size`,
      'Split into smaller sub-components, use dynamic() import for heavy sections',
      top.path, '15-20% bundle reduction', '4h');
  }

  const lazyDir = path.join(APP_ROOT, 'components/lazy');
  const lazy = fs.existsSync(lazyDir) && fs.statSync(lazyDir).isDirectory() && fs.readdirSync(lazyDir).length > 0;
  const hasDynamic = heavyComponents.some(c => readFile(c.path).includes('dynamic('));
  if (!hasDynamic && heavyComponents.filter(c => c.size > 40_000).length > 2) {
    find('SS-PERF-002', 'HIGH', 'Heavy components not using dynamic() imports',
      'Large components loaded synchronously block initial page render',
      "Use Next.js dynamic() with { ssr: false } for heavy client-only components",
      'components/', '20-30% reduction in initial JS', '3h');
  } else {
    find('SS-PERF-002', 'PASS', 'Dynamic imports detected', '', '');
  }
}

// ─── CSS ANALYSIS ──────────────────────────────────────────────────────────────

const globalsCssSize = fileSize('app/globals.css');
const adminCssSize = fileSize('app/admin-dashboard.css');
const shellCssSize = fileSize('app/admin-shell.css');
const totalCssSize = globalsCssSize + adminCssSize + shellCssSize;

console.log(`📊 CSS sizes: globals=${formatBytes(globalsCssSize)} admin=${formatBytes(adminCssSize)} shell=${formatBytes(shellCssSize)}`);

if (globalsCssSize > 100_000) {
  find('SS-PERF-010', 'HIGH', `globals.css is extremely large (${formatBytes(globalsCssSize)})`,
    'Blocks initial render, increases download time on mobile',
    'Run PurgeCSS analysis, migrate to Tailwind utilities, split critical vs. non-critical CSS',
    'app/globals.css', `Est. 40-60% reduction possible`, '6h');
} else if (globalsCssSize > 50_000) {
  find('SS-PERF-010', 'MEDIUM', `globals.css is large (${formatBytes(globalsCssSize)})`,
    'May contain unused styles from removed features',
    'Run PurgeCSS, remove dead CSS rules',
    'app/globals.css', '20-30% reduction', '3h');
} else {
  find('SS-PERF-010', 'PASS', `globals.css size acceptable (${formatBytes(globalsCssSize)})`, '', '');
}

if (adminCssSize > 100_000) {
  find('SS-PERF-011', 'HIGH', `admin-dashboard.css is extremely large (${formatBytes(adminCssSize)})`,
    'Admin pages load slowly due to massive stylesheet',
    'Split into per-component CSS modules or migrate to Tailwind utilities',
    'app/admin-dashboard.css', '50-70% reduction with Tailwind migration', '8h');
} else {
  find('SS-PERF-011', 'MEDIUM', `admin-dashboard.css is large (${formatBytes(adminCssSize)})`,
    'Admin pages carry extra CSS payload',
    'Split admin CSS and lazy-load per admin section',
    'app/admin-dashboard.css', '30-50% reduction', '4h');
}

// ─── NEXT.JS CONFIG ──────────────────────────────────────────────────────────

const nextConfig = readFile('next.config.js');

if (nextConfig.includes("images:") && (nextConfig.includes('formats') || nextConfig.includes('webp'))) {
  find('SS-PERF-020', 'PASS', 'Next.js image optimisation configured', '', '');
} else {
  find('SS-PERF-020', 'MEDIUM', 'Next.js image formats not explicitly configured',
    'Images served in older formats (PNG/JPEG) instead of WebP/AVIF',
    "Add `images: { formats: ['image/avif', 'image/webp'] }` to next.config.js",
    'next.config.js', '20-40% image size reduction', '30min');
}

if (nextConfig.includes('compress') || nextConfig.includes('gzip') || nextConfig.includes('brotli')) {
  find('SS-PERF-021', 'PASS', 'Compression configured in Next.js', '', '');
}

if (nextConfig.includes('poweredByHeader: false')) {
  find('SS-PERF-022', 'PASS', 'X-Powered-By header disabled', '', '');
} else {
  find('SS-PERF-022', 'LOW', 'X-Powered-By header not disabled',
    'Reveals Next.js version to attackers',
    "Add `poweredByHeader: false` to next.config.js",
    'next.config.js', undefined, '5min');
}

// Check for bundle analyser
const pkg = readFile('package.json');
if (pkg.includes('bundle-analyzer') || pkg.includes('@next/bundle-analyzer')) {
  find('SS-PERF-023', 'PASS', 'Bundle analyser available', '', '');
} else {
  find('SS-PERF-023', 'LOW', 'No bundle analyser configured',
    'Cannot easily identify bundle bloat',
    'Install @next/bundle-analyzer for visual bundle analysis',
    'package.json', undefined, '30min');
}

// ─── IMAGE USAGE ──────────────────────────────────────────────────────────────

// Scan for raw <img> tags in components
let rawImgCount = 0;
const componentFiles = getAllFiles('components', ['.tsx', '.ts']);
for (const f of componentFiles) {
  const content = readFile(f);
  const count = countPattern(content, /<img\s/g);
  if (count > 0) rawImgCount += count;
}

if (rawImgCount > 0) {
  find('SS-PERF-030', 'MEDIUM', `${rawImgCount} raw <img> tag(s) found — not using next/image`,
    'Missing automatic optimisation, lazy loading, and WebP conversion',
    'Replace <img> with next/image component for automatic optimisation',
    'components/', '20-30% image payload reduction', '2h');
} else {
  find('SS-PERF-030', 'PASS', 'All images use next/image or similar', '', '');
}

// Check large static images
const googleAuthImg = fileSize('google_auth_image.png');
if (googleAuthImg > 100_000) {
  find('SS-PERF-031', 'LOW', `google_auth_image.png is ${formatBytes(googleAuthImg)} — should be optimised`,
    'Unnecessarily large image file',
    'Compress to <50KB using WebP format',
    'google_auth_image.png', `${formatBytes(googleAuthImg - 50_000)} savings`, '10min');
}

// ─── REACT PERFORMANCE ────────────────────────────────────────────────────────

const sqliteLib = readFile('lib/sqlite.ts');

// Check for N+1 patterns (simplified: look for queries inside loops)
const n1Pattern = /for\s*\(.*\)[\s\S]{0,200}(db\.|prepare\(|\.all\(|\.get\()/;
if (n1Pattern.test(sqliteLib)) {
  find('SS-PERF-040', 'MEDIUM', 'Potential N+1 query patterns in lib/sqlite.ts',
    'Database queries inside loops cause exponential performance degradation',
    'Use SQL JOINs or batch queries instead of per-row queries',
    'lib/sqlite.ts', '50-90% DB query time reduction', '4h');
} else {
  find('SS-PERF-040', 'PASS', 'No obvious N+1 query patterns detected', '', '');
}

// Check for missing LIMIT clauses in queries fetching many rows
const unlimitedSelect = countPattern(sqliteLib, /SELECT\s+\*\s+FROM\s+\w+(?!\s+WHERE|\s+LIMIT)/ig);
if (unlimitedSelect > 3) {
  find('SS-PERF-041', 'MEDIUM', `${unlimitedSelect} SELECT * queries without LIMIT in lib/sqlite.ts`,
    'Unbounded queries can return thousands of rows, consuming memory',
    'Add LIMIT clauses to all list queries, use cursor-based pagination',
    'lib/sqlite.ts', 'Prevents memory spikes on large tables', '3h');
}

// ─── SERVER PERFORMANCE ───────────────────────────────────────────────────────

const server = readFile('server.js');

// Check for Socket.IO room cleanup
if (server.includes('socket.leave') || server.includes('room') && server.includes('cleanup')) {
  find('SS-PERF-050', 'PASS', 'Socket.IO room cleanup implemented', '', '');
} else if (server.includes('socket.io') || server.includes('io.on')) {
  find('SS-PERF-050', 'MEDIUM', 'Socket.IO room cleanup not detected',
    'Memory leak: rooms accumulate for disconnected clients',
    "Add socket.on('disconnect') handler to clean up rooms",
    'server.js', 'Prevents memory growth over time', '2h');
}

// Check for DB connection per request
if (server.includes('getSqliteDb') || server.includes('Database(') && !server.includes('singleton')) {
  find('SS-PERF-051', 'LOW', 'Verify SQLite connection is singleton (not per-request)',
    'Opening a new DB connection per request wastes resources',
    'Ensure better-sqlite3 Database instance is created once and reused (module singleton)',
    'server.js', 'Reduces connection overhead', '1h');
}

// ─── HELPER ───────────────────────────────────────────────────────────────────

function getAllFiles(dir: string, exts: string[]): string[] {
  const result: string[] = [];
  const full = path.join(APP_ROOT, dir);
  if (!fs.existsSync(full)) return result;
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(p);
      } else if (exts.some(e => entry.name.endsWith(e))) {
        result.push(p.replace(APP_ROOT + path.sep, '').replace(/\\/g, '/'));
      }
    }
  }
  walk(full);
  return result;
}

// ─── GENERATE REPORT ──────────────────────────────────────────────────────────

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const bySeverity = (s: PerfFinding['severity']) => findings.filter(f => f.severity === s);
const critical = bySeverity('CRITICAL');
const high = bySeverity('HIGH');
const medium = bySeverity('MEDIUM');
const low = bySeverity('LOW');

const score = Math.max(0, 100 - (critical.length * 25) - (high.length * 12) - (medium.length * 5) - (low.length * 2));
const scoreLabel = score >= 90 ? '🟢 Excellent' : score >= 70 ? '🟡 Good' : score >= 50 ? '🟠 Needs Work' : '🔴 Poor';

function fmt(f: PerfFinding): string {
  return `### [${f.id}] ${f.title}
- **File**: \`${f.file || 'N/A'}\`
- **Impact**: ${f.impact}
- **Fix**: ${f.fix}${f.gain ? `\n- **Est. Gain**: ${f.gain}` : ''}${f.effort ? `\n- **Effort**: ${f.effort}` : ''}
`;
}

const topQuickWins = [...high, ...medium, ...low]
  .filter(f => f.effort && (f.effort.includes('min') || f.effort.includes('30') || f.effort.includes('1h')))
  .slice(0, 5);

const report = `# ⚡ MIMO Performance Report
**Generated**: ${new Date().toISOString()}
**Auditor**: mimo-perf
**App**: South Street Umrah & Hajj Agency

## Performance Score: ${score}/100 ${scoreLabel}

**Findings**: 🔴 ${critical.length} CRITICAL · 🟠 ${high.length} HIGH · 🟡 ${medium.length} MEDIUM · 🔵 ${low.length} LOW · ✅ ${passCount} PASS

---

## Executive Summary

${high.length > 0 ? `The app has **${high.length} HIGH severity performance issue(s)** that significantly impact load time and resource usage.` : 'No critical performance blockers detected.'} The main concerns are CSS bloat (${formatBytes(totalCssSize)} total) and heavy component files. Addressing CSS and implementing dynamic imports will yield the biggest improvements.

---

## Core Web Vitals — Estimated Status

| Metric | Status | Primary Cause |
|---|---|---|
| LCP (Largest Contentful Paint) | ${globalsCssSize > 100_000 ? '🟠 At Risk' : '🟢 Target Met'} | ${globalsCssSize > 100_000 ? 'Large CSS blocking render' : 'CSS size acceptable'} |
| FID (First Input Delay) | ${heavyComponents.filter(c => c.size > 50_000).length > 2 ? '🟠 At Risk' : '🟢 Target Met'} | ${heavyComponents.filter(c => c.size > 50_000).length > 2 ? 'Large JS components' : 'Component sizes manageable'} |
| CLS (Cumulative Layout Shift) | 🟡 Unknown | Images without explicit dimensions |
| Bundle Size | ${heavyComponents.filter(c => c.size > 50_000).length > 0 ? '🟠 Large' : '🟢 OK'} | ${heavyComponents.filter(c => c.size > 50_000).length} large components |

---
${critical.length > 0 ? `
## 🔴 CRITICAL Issues

${critical.map(fmt).join('\n')}
` : ''}
${high.length > 0 ? `
## 🟠 HIGH Issues

${high.map(fmt).join('\n')}
` : ''}
${medium.length > 0 ? `
## 🟡 MEDIUM Issues

${medium.map(fmt).join('\n')}
` : ''}
${low.length > 0 ? `
## 🔵 LOW Enhancements

${low.map(fmt).join('\n')}
` : ''}

---

## 📦 Heavy Component Analysis

| Component | Size | Issues |
|---|---|---|
${heavyComponents.slice(0, 15).map(c =>
    `| \`${path.basename(c.path)}\` | ${formatBytes(c.size)} | ${c.issues.join('; ') || '—'} |`
  ).join('\n')}

---

## 🎨 CSS Bloat Analysis

| File | Size | Status | Action |
|---|---|---|---|
| \`app/globals.css\` | ${formatBytes(globalsCssSize)} | ${globalsCssSize > 100_000 ? '🔴 Very Large' : globalsCssSize > 50_000 ? '🟠 Large' : '✅ OK'} | ${globalsCssSize > 100_000 ? 'PurgeCSS + Tailwind migration' : 'Minor cleanup'} |
| \`app/admin-dashboard.css\` | ${formatBytes(adminCssSize)} | ${adminCssSize > 100_000 ? '🔴 Very Large' : '🟠 Large'} | Split and lazy-load |
| \`app/admin-shell.css\` | ${formatBytes(shellCssSize)} | ${shellCssSize > 10_000 ? '🟡 Medium' : '✅ OK'} | Review for dead CSS |
| **Total** | **${formatBytes(totalCssSize)}** | | |

---

## ⚡ Top Quick Wins

${topQuickWins.length > 0
    ? topQuickWins.map((f, i) => `${i + 1}. **[${f.effort}]** ${f.title}${f.gain ? ` — Gain: ${f.gain}` : ''}`).join('\n')
    : '1. Enable WebP image formats in next.config.js (30 min)\n2. Add poweredByHeader: false (5 min)\n3. Install @next/bundle-analyzer (30 min)'}

---

*Report generated by MIMO Performance Agent · Run \`npx tsx mimo/scripts/perf-audit.ts\` to refresh*
`;

fs.writeFileSync(REPORT_FILE, report);
console.log(`\n✅ Performance audit complete`);
console.log(`   Score: ${score}/100 ${scoreLabel}`);
console.log(`   🔴 ${critical.length} CRITICAL  🟠 ${high.length} HIGH  🟡 ${medium.length} MEDIUM  🔵 ${low.length} LOW`);
console.log(`   Total CSS: ${formatBytes(totalCssSize)} | Heavy components: ${heavyComponents.length}`);
console.log(`   Report: ${REPORT_FILE}\n`);
