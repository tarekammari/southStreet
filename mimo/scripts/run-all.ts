#!/usr/bin/env tsx
/**
 * MIMO Senior Orchestrator — run-all.ts
 * Runs all MIMO agents in sequence and merges results into a unified executive report.
 * Run: npx tsx mimo/scripts/run-all.ts
 * Output: mimo/reports/mimo-report.md
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.join(APP_ROOT, 'mimo', 'reports');
const EXEC_REPORT = path.join(REPORT_DIR, 'mimo-report.md');

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const start = Date.now();

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         MIMO — Multi-Agent Intelligence System           ║');
console.log('║         South Street · Umrah & Hajj Agency               ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

interface AgentResult {
  name: string;
  label: string;
  script: string;
  reportFile: string;
  success: boolean;
  duration: number;
  criticals: number;
  highs: number;
  mediums: number;
  lows: number;
  score: number;
}

const agents = [
  { name: 'mimo-security', label: '🛡️  MIMO Security',     script: 'security-audit.ts',  reportFile: 'security.md' },
  { name: 'mimo-auth',     label: '🔐 MIMO Auth',          script: 'auth-audit.ts',       reportFile: 'auth.md' },
  { name: 'mimo-perf',     label: '⚡ MIMO Performance',   script: 'perf-audit.ts',       reportFile: 'performance.md' },
  { name: 'mimo-account',  label: '💰 MIMO Accountant',    script: 'financial-report.ts', reportFile: 'financial.md' },
];

const results: AgentResult[] = [];

// ─── RUN EACH AGENT ──────────────────────────────────────────────────────────

for (const agent of agents) {
  const scriptPath = path.join(APP_ROOT, 'mimo', 'scripts', agent.script);
  console.log(`Running ${agent.label}...`);
  const t0 = Date.now();
  let success = false;
  let output = '';

  try {
    output = execSync(`npx tsx "${scriptPath}"`, {
      cwd: APP_ROOT,
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: 'pipe',
    });
    success = true;
    process.stdout.write(output);
  } catch (err: unknown) {
    const e = err as { message?: string; stdout?: string; stderr?: string };
    console.error(`   ❌ ${agent.label} failed: ${e?.message?.split('\n')[0] || 'unknown error'}`);
    if (e?.stdout) process.stdout.write(e.stdout);
    if (e?.stderr) process.stderr.write(e.stderr || '');
  }

  // Parse counts from report
  const reportPath = path.join(REPORT_DIR, agent.reportFile);
  let criticals = 0, highs = 0, mediums = 0, lows = 0, score = 0;
  if (success && fs.existsSync(reportPath)) {
    const content = fs.readFileSync(reportPath, 'utf-8');
    const scoreMatch = content.match(/Score:\s*(\d+)\/100/);
    if (scoreMatch) score = parseInt(scoreMatch[1]);
    const countMatch = content.match(/🔴\s*(\d+)\s*CRITICAL\s*·\s*🟠\s*(\d+)\s*HIGH\s*·\s*🟡\s*(\d+)\s*MEDIUM\s*·\s*🔵\s*(\d+)\s*LOW/);
    if (countMatch) {
      criticals = parseInt(countMatch[1]);
      highs = parseInt(countMatch[2]);
      mediums = parseInt(countMatch[3]);
      lows = parseInt(countMatch[4]);
    }
  }

  results.push({
    ...agent,
    success,
    duration: Date.now() - t0,
    criticals, highs, mediums, lows, score,
  });
}

// ─── BUILD EXECUTIVE REPORT ───────────────────────────────────────────────────

const totalCriticals = results.reduce((s, r) => s + r.criticals, 0);
const totalHighs = results.reduce((s, r) => s + r.highs, 0);
const totalMediums = results.reduce((s, r) => s + r.mediums, 0);
const totalLows = results.reduce((s, r) => s + r.lows, 0);
const totalFindings = totalCriticals + totalHighs + totalMediums + totalLows;

const overallScore = results.filter(r => r.score > 0).length > 0
  ? Math.round(results.filter(r => r.score > 0).reduce((s, r) => s + r.score, 0) / results.filter(r => r.score > 0).length)
  : 0;
const overallLabel = overallScore >= 90 ? '🟢 Excellent' : overallScore >= 70 ? '🟡 Good' : overallScore >= 50 ? '🟠 Needs Work' : '🔴 Critical';

// Read key findings from each report
function extractSection(reportFile: string, sectionTitle: string): string {
  const p = path.join(REPORT_DIR, reportFile);
  if (!fs.existsSync(p)) return '';
  const content = fs.readFileSync(p, 'utf-8');
  const sectionRx = new RegExp(`## ${sectionTitle}[\\s\\S]*?(?=\\n## |$)`, 'i');
  const match = content.match(sectionRx);
  return match ? match[0].split('\n').slice(1, 15).join('\n') : '';
}

function extractCriticalAndHigh(reportFile: string): string {
  const p = path.join(REPORT_DIR, reportFile);
  if (!fs.existsSync(p)) return '';
  const content = fs.readFileSync(p, 'utf-8');
  const lines: string[] = [];
  let inSection = false;
  for (const line of content.split('\n')) {
    if (line.match(/^## 🔴 CRITICAL|^## 🟠 HIGH/)) { inSection = true; }
    else if (line.match(/^## /) && !line.match(/CRITICAL|HIGH/)) { inSection = false; }
    if (inSection && line.match(/^### \[/)) {
      lines.push('- ' + line.replace(/^### /, ''));
    }
    if (lines.length >= 5) break;
  }
  return lines.join('\n');
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

const execReport = `# 👑 MIMO Executive Report
**Generated**: ${new Date().toISOString()}
**Orchestrator**: MIMO Senior
**App**: South Street Umrah & Hajj Agency
**Duration**: ${elapsed}s

---

## 🏆 Overall Health Score: ${overallScore}/100 ${overallLabel}

\`\`\`
╔══════════════════════════════════════════════════════════╗
║              MIMO EXECUTIVE SUMMARY                      ║
╠══════════════════════════════════════════════════════════╣
║  🔴 CRITICAL:   ${String(totalCriticals).padStart(4)}   (fix immediately)             ║
║  🟠 HIGH:       ${String(totalHighs).padStart(4)}   (fix before release)           ║
║  🟡 MEDIUM:     ${String(totalMediums).padStart(4)}   (next sprint)                 ║
║  🔵 LOW:        ${String(totalLows).padStart(4)}   (enhancements)               ║
║  ─────────────────────────────────────────────────────  ║
║  Total Findings: ${String(totalFindings).padStart(4)}                                ║
║  Overall Score:  ${String(overallScore).padStart(4)}/100  ${overallLabel.padEnd(28)}║
╚══════════════════════════════════════════════════════════╝
\`\`\`

---

## Agent Status

| Agent | Score | 🔴 | 🟠 | 🟡 | 🔵 | Status | Time |
|---|---|---|---|---|---|---|---|
${results.map(r =>
  `| ${r.label} | ${r.score > 0 ? `${r.score}/100` : 'N/A'} | ${r.criticals} | ${r.highs} | ${r.mediums} | ${r.lows} | ${r.success ? '✅ Done' : '❌ Failed'} | ${(r.duration / 1000).toFixed(1)}s |`
).join('\n')}

---

## 📋 Priority Action Plan

${totalCriticals > 0 ? `### 🔴 CRITICAL — Act Immediately

${results.map(r => {
  const section = extractCriticalAndHigh(r.reportFile);
  if (!section || !section.includes('CRITICAL')) return '';
  return `**${r.label}**:\n${section.split('\n').filter(l => l.includes('SS-SEC') || l.includes('SS-AUTH') || l.includes('SS-PERF')).slice(0, 3).join('\n')}`;
}).filter(Boolean).join('\n\n')}
` : '✅ No critical issues found across all agents.\n'}

### 🟠 HIGH — Before Next Release

${results.map(r => {
  const lines = extractCriticalAndHigh(r.reportFile);
  if (!lines) return '';
  return `**${r.label}**: ${lines.split('\n').slice(0, 2).join(' | ')}`;
}).filter(Boolean).join('\n')}

---

## 📊 Individual Reports

| Report | File | Description |
|---|---|---|
| 🛡️ Security | \`mimo/reports/security.md\` | Firewall, JWT, SQL injection, headers |
| 🔐 Auth | \`mimo/reports/auth.md\` | RBAC, sessions, OAuth, cookies |
| ⚡ Performance | \`mimo/reports/performance.md\` | Bundle, CSS, DB queries, media |
| 💰 Financial | \`mimo/reports/financial.md\` | Revenue, P&L, receivables, agents |

---

## 🔄 How to Re-Run

\`\`\`bash
# Full orchestrated run (all agents)
npx tsx mimo/scripts/run-all.ts

# Individual agents
npx tsx mimo/scripts/security-audit.ts
npx tsx mimo/scripts/auth-audit.ts
npx tsx mimo/scripts/perf-audit.ts
npx tsx mimo/scripts/financial-report.ts
\`\`\`

---

*MIMO — Multi-Agent Intelligence & Management Operations*
*South Street Umrah & Hajj Agency · v1.0*
`;

fs.writeFileSync(EXEC_REPORT, execReport);

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log(`║  MIMO Complete · ${elapsed}s · Score: ${overallScore}/100 ${overallLabel.padEnd(18)}║`);
console.log(`║  🔴 ${totalCriticals} CRITICAL  🟠 ${totalHighs} HIGH  🟡 ${totalMediums} MEDIUM  🔵 ${totalLows} LOW${' '.repeat(Math.max(0, 16 - String(totalCriticals+totalHighs+totalMediums+totalLows).length))}║`);
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  Executive report: mimo/reports/mimo-report.md          ║`);
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
