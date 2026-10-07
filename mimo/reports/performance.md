# ⚡ MIMO Performance Report
**Generated**: 2026-09-13T20:07:16.522Z
**Auditor**: mimo-perf
**App**: South Street Umrah & Hajj Agency

## Performance Score: 36/100 🔴 Poor

**Findings**: 🔴 0 CRITICAL · 🟠 3 HIGH · 🟡 4 MEDIUM · 🔵 4 LOW · ✅ 1 PASS

---

## Executive Summary

The app has **3 HIGH severity performance issue(s)** that significantly impact load time and resource usage. The main concerns are CSS bloat (328.0 KB total) and heavy component files. Addressing CSS and implementing dynamic imports will yield the biggest improvements.

---

## Core Web Vitals — Estimated Status

| Metric | Status | Primary Cause |
|---|---|---|
| LCP (Largest Contentful Paint) | 🟠 At Risk | Large CSS blocking render |
| FID (First Input Delay) | 🟢 Target Met | Component sizes manageable |
| CLS (Cumulative Layout Shift) | 🟡 Unknown | Images without explicit dimensions |
| Bundle Size | 🟠 Large | 2 large components |

---


## 🟠 HIGH Issues

### [SS-PERF-001] Extremely large component: SakhrAgent.tsx
- **File**: `components/SakhrAgent.tsx`
- **Impact**: 71.7 KB component impacts initial bundle size
- **Fix**: Split into smaller sub-components, use dynamic() import for heavy sections
- **Est. Gain**: 15-20% bundle reduction
- **Effort**: 4h

### [SS-PERF-010] globals.css is extremely large (179.0 KB)
- **File**: `app/globals.css`
- **Impact**: Blocks initial render, increases download time on mobile
- **Fix**: Run PurgeCSS analysis, migrate to Tailwind utilities, split critical vs. non-critical CSS
- **Est. Gain**: Est. 40-60% reduction possible
- **Effort**: 6h

### [SS-PERF-011] admin-dashboard.css is extremely large (142.2 KB)
- **File**: `app/admin-dashboard.css`
- **Impact**: Admin pages load slowly due to massive stylesheet
- **Fix**: Split into per-component CSS modules or migrate to Tailwind utilities
- **Est. Gain**: 50-70% reduction with Tailwind migration
- **Effort**: 8h



## 🟡 MEDIUM Issues

### [SS-PERF-020] Next.js image formats not explicitly configured
- **File**: `next.config.js`
- **Impact**: Images served in older formats (PNG/JPEG) instead of WebP/AVIF
- **Fix**: Add `images: { formats: ['image/avif', 'image/webp'] }` to next.config.js
- **Est. Gain**: 20-40% image size reduction
- **Effort**: 30min

### [SS-PERF-030] 21 raw <img> tag(s) found — not using next/image
- **File**: `components/`
- **Impact**: Missing automatic optimisation, lazy loading, and WebP conversion
- **Fix**: Replace <img> with next/image component for automatic optimisation
- **Est. Gain**: 20-30% image payload reduction
- **Effort**: 2h

### [SS-PERF-040] Potential N+1 query patterns in lib/sqlite.ts
- **File**: `lib/sqlite.ts`
- **Impact**: Database queries inside loops cause exponential performance degradation
- **Fix**: Use SQL JOINs or batch queries instead of per-row queries
- **Est. Gain**: 50-90% DB query time reduction
- **Effort**: 4h

### [SS-PERF-050] Socket.IO room cleanup not detected
- **File**: `server.js`
- **Impact**: Memory leak: rooms accumulate for disconnected clients
- **Fix**: Add socket.on('disconnect') handler to clean up rooms
- **Est. Gain**: Prevents memory growth over time
- **Effort**: 2h



## 🔵 LOW Enhancements

### [SS-PERF-022] X-Powered-By header not disabled
- **File**: `next.config.js`
- **Impact**: Reveals Next.js version to attackers
- **Fix**: Add `poweredByHeader: false` to next.config.js
- **Effort**: 5min

### [SS-PERF-023] No bundle analyser configured
- **File**: `package.json`
- **Impact**: Cannot easily identify bundle bloat
- **Fix**: Install @next/bundle-analyzer for visual bundle analysis
- **Effort**: 30min

### [SS-PERF-031] google_auth_image.png is 224.0 KB — should be optimised
- **File**: `google_auth_image.png`
- **Impact**: Unnecessarily large image file
- **Fix**: Compress to <50KB using WebP format
- **Est. Gain**: 175.1 KB savings
- **Effort**: 10min

### [SS-PERF-051] Verify SQLite connection is singleton (not per-request)
- **File**: `server.js`
- **Impact**: Opening a new DB connection per request wastes resources
- **Fix**: Ensure better-sqlite3 Database instance is created once and reused (module singleton)
- **Est. Gain**: Reduces connection overhead
- **Effort**: 1h



---

## 📦 Heavy Component Analysis

| Component | Size | Issues |
|---|---|---|
| `SakhrAgent.tsx` | 71.7 KB | Large file (71.7 KB) — consider splitting; Missing React.memo — may cause unnecessary re-renders; Heavy client component (71.7 KB) — split or lazy load |
| `UserAccessDashboard.tsx` | 59.0 KB | Large file (59.0 KB) — consider splitting; Missing React.memo — may cause unnecessary re-renders; Heavy client component (59.0 KB) — split or lazy load |
| `sakhrIntents.ts` | 40.9 KB | — |
| `AiKnowledgeManager.tsx` | 38.0 KB | Missing React.memo — may cause unnecessary re-renders; Heavy client component (38.0 KB) — split or lazy load |
| `SecurityCenter.tsx` | 33.6 KB | Missing React.memo — may cause unnecessary re-renders; Heavy client component (33.6 KB) — split or lazy load |
| `RecordBigCardView.tsx` | 28.7 KB | Missing React.memo — may cause unnecessary re-renders |
| `BookingWizard.tsx` | 28.5 KB | Missing React.memo — may cause unnecessary re-renders |
| `route.ts` | 23.8 KB | — |
| `page.tsx` | 23.5 KB | Missing React.memo — may cause unnecessary re-renders |
| `AccountantDashboard.tsx` | 23.2 KB | Missing React.memo — may cause unnecessary re-renders |
| `UserProfileModal.tsx` | 21.3 KB | Missing React.memo — may cause unnecessary re-renders |
| `ServerHealth.tsx` | 21.0 KB | Missing React.memo — may cause unnecessary re-renders |

---

## 🎨 CSS Bloat Analysis

| File | Size | Status | Action |
|---|---|---|---|
| `app/globals.css` | 179.0 KB | 🔴 Very Large | PurgeCSS + Tailwind migration |
| `app/admin-dashboard.css` | 142.2 KB | 🔴 Very Large | Split and lazy-load |
| `app/admin-shell.css` | 6.8 KB | ✅ OK | Review for dead CSS |
| **Total** | **328.0 KB** | | |

---

## ⚡ Top Quick Wins

1. **[30min]** Next.js image formats not explicitly configured — Gain: 20-40% image size reduction
2. **[5min]** X-Powered-By header not disabled
3. **[30min]** No bundle analyser configured
4. **[10min]** google_auth_image.png is 224.0 KB — should be optimised — Gain: 175.1 KB savings
5. **[1h]** Verify SQLite connection is singleton (not per-request) — Gain: Reduces connection overhead

---

*Report generated by MIMO Performance Agent · Run `npx tsx mimo/scripts/perf-audit.ts` to refresh*
