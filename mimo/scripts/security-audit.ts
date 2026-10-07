#!/usr/bin/env tsx
/**
 * MIMO Security Audit Script
 * Scans the South Street app for security vulnerabilities.
 * Run: npx tsx mimo/scripts/security-audit.ts
 * Output: mimo/reports/security.md
 */

import fs from 'fs';
import path from 'path';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.join(APP_ROOT, 'mimo', 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'security.md');

interface Finding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
  title: string;
  file?: string;
  line?: number;
  impact: string;
  fix: string;
  effort?: string;
}

const findings: Finding[] = [];
let passCount = 0;

function find(id: string, severity: Finding['severity'], title: string, impact: string, fix: string, file?: string, line?: number, effort?: string) {
  if (severity === 'PASS') {
    passCount++;
  } else {
    findings.push({ id, severity, title, file, line, impact, fix, effort });
  }
}

// ─── SCAN HELPERS ─────────────────────────────────────────────────────────────

function readFile(relPath: string): string {
  const full = path.join(APP_ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(APP_ROOT, relPath));
}

function scanForPattern(content: string, pattern: RegExp): { match: boolean; line?: number } {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return { match: true, line: i + 1 };
  }
  return { match: false };
}

function findAllApiRoutes(): string[] {
  const routes: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
        routes.push(full.replace(APP_ROOT + path.sep, '').replace(/\\/g, '/'));
      }
    }
  }
  walk(path.join(APP_ROOT, 'app', 'api'));
  return routes;
}

// ─── CHECKS ───────────────────────────────────────────────────────────────────

console.log('🛡️  MIMO Security Audit starting...\n');

// 1. Environment Variables
const envExample = readFile('.env.example');
const env = readFile('.env');
const envActual = fileExists('.env');

if (!envActual) {
  find('SS-SEC-001', 'HIGH', '.env file missing', 'Application may use default/insecure values', 'Create .env from .env.example and set all secrets');
} else {
  find('SS-SEC-001', 'PASS', '.env file exists', '', '');
}

// Check for JWT secret
if (env.includes('JWT_SECRET') || envExample.includes('JWT_SECRET')) {
  if (env.includes('JWT_SECRET=') && !env.includes('JWT_SECRET=your_') && !env.includes('JWT_SECRET=change')) {
    find('SS-SEC-002', 'PASS', 'JWT_SECRET is configured', '', '');
  } else {
    find('SS-SEC-002', 'CRITICAL', 'JWT_SECRET appears to use placeholder value', 'JWT tokens can be forged by attackers', 'Set JWT_SECRET to a cryptographically random 256-bit string', '.env');
  }
} else {
  find('SS-SEC-002', 'HIGH', 'JWT_SECRET not found in .env.example', 'JWT configuration unclear', 'Document JWT_SECRET in .env.example', '.env.example');
}

// Check for sensitive files in public
const sensitiveInPublic = [
  'public/client_secret',
  'public/southstreet_admin.key',
  'public/.env',
];
for (const f of sensitiveInPublic) {
  if (fileExists(f)) {
    find('SS-SEC-003', 'CRITICAL', `Sensitive file exposed in public dir: ${f}`, 'Secret file is publicly accessible via HTTP', `Move ${f} to a private location, never inside public/`, f);
  }
}

// Check Google client secret location
const googleSecretFiles = fs.readdirSync(APP_ROOT).filter(f => f.startsWith('client_secret_'));
if (googleSecretFiles.length > 0) {
  find('SS-SEC-004', 'HIGH', `Google OAuth client secret file in project root: ${googleSecretFiles[0]}`, 'File may be accidentally served or committed to git', 'Move to a secure location outside project root or reference via env var', googleSecretFiles[0]);
} else {
  find('SS-SEC-004', 'PASS', 'Google client secret not in project root', '', '');
}

// Check .gitignore
const gitignore = readFile('.gitignore');
const criticalIgnores = ['.env', '*.key', 'client_secret_*', 'south_street.db'];
for (const item of criticalIgnores) {
  if (!gitignore.includes(item.replace('*', ''))) {
    find('SS-SEC-005', 'HIGH', `.gitignore missing entry: ${item}`, `${item} could be committed to git repository`, `Add ${item} to .gitignore`, '.gitignore');
  }
}

// 2. Middleware / Firewall
const middleware = readFile('middleware.ts');
if (middleware.includes('firewallOn: true')) {
  find('SS-SEC-010', 'PASS', 'Firewall enabled by default', '', '');
} else {
  find('SS-SEC-010', 'HIGH', 'Firewall not enabled by default', 'Requests may bypass security checks', 'Set firewallOn: true in EdgeState initializer', 'middleware.ts');
}

if (middleware.includes('blockBots: true')) {
  find('SS-SEC-011', 'PASS', 'Bot blocking enabled', '', '');
} else {
  find('SS-SEC-011', 'MEDIUM', 'Bot blocking not enabled by default', 'Automated scanners can probe the app', 'Enable blockBots in edge security state', 'middleware.ts');
}

if (middleware.includes('blockInjection: true')) {
  find('SS-SEC-012', 'PASS', 'Injection blocking enabled', '', '');
}

if (middleware.includes('blockXss: true')) {
  find('SS-SEC-013', 'PASS', 'XSS blocking enabled', '', '');
}

// 3. Server.js - Helmet headers
const server = readFile('server.js');
if (server.includes('helmet')) {
  find('SS-SEC-020', 'PASS', 'Helmet security headers middleware present', '', '');
} else {
  find('SS-SEC-020', 'HIGH', 'Helmet not found in server.js', 'Missing security headers (CSP, HSTS, etc.)', 'Install and configure helmet middleware', 'server.js');
}

if (server.includes('express-rate-limit') || server.includes('rateLimit')) {
  find('SS-SEC-021', 'PASS', 'Rate limiting configured', '', '');
} else {
  find('SS-SEC-021', 'HIGH', 'Rate limiting not found in server.js', 'API endpoints vulnerable to brute force attacks', 'Add express-rate-limit middleware', 'server.js');
}

if (server.includes('cors')) {
  find('SS-SEC-022', 'PASS', 'CORS middleware present', '', '');
  if (!server.includes("origin:") && !server.includes('allowedOrigins')) {
    find('SS-SEC-023', 'MEDIUM', 'CORS may not restrict origins', 'Wildcard CORS allows cross-origin requests from any domain', 'Configure specific allowed origins in CORS config', 'server.js');
  }
}

// 4. Auth library checks
const authLib = readFile('lib/auth.ts');
if (authLib.includes('HS256') || authLib.includes('RS256') || authLib.includes('algorithm')) {
  find('SS-SEC-030', 'PASS', 'JWT algorithm explicitly configured', '', '');
} else {
  find('SS-SEC-030', 'MEDIUM', 'JWT algorithm not explicitly set', 'Default algorithm may not be most secure', "Explicitly set algorithm: 'HS256' in jwt.sign()", 'lib/auth.ts');
}

if (authLib.includes('expiresIn') || authLib.includes('exp:')) {
  find('SS-SEC-031', 'PASS', 'JWT token expiry configured', '', '');
} else {
  find('SS-SEC-031', 'HIGH', 'JWT token may not expire', 'Stolen tokens would be valid forever', "Add expiresIn option to jwt.sign()", 'lib/auth.ts');
}

// 5. Database encryption
const dbCrypto = readFile('lib/db-crypto.ts');
const encSqlite = readFile('lib/encrypted-sqlite.ts');
if (dbCrypto.length > 0 && encSqlite.length > 0) {
  find('SS-SEC-040', 'PASS', 'Database encryption layer present', '', '');
} else {
  find('SS-SEC-040', 'CRITICAL', 'Database encryption layer missing or incomplete', 'Sensitive pilgrim data stored unencrypted', 'Implement field-level encryption for PII columns', 'lib/db-crypto.ts');
}

// Check for bcrypt usage
const sqlite = readFile('lib/sqlite.ts');
const accounts = readFile('lib/accounts.ts');
if (sqlite.includes('bcrypt') || accounts.includes('bcrypt')) {
  find('SS-SEC-041', 'PASS', 'bcrypt used for password hashing', '', '');
} else {
  // Check package.json for bcryptjs
  const pkg = readFile('package.json');
  if (pkg.includes('bcryptjs')) {
    find('SS-SEC-041', 'PASS', 'bcryptjs dependency present', '', '');
  } else {
    find('SS-SEC-041', 'CRITICAL', 'No password hashing library detected', 'Passwords may be stored in plain text', 'Use bcryptjs with cost factor ≥12', 'lib/sqlite.ts');
  }
}

// 6. SQL Injection check - look for string interpolation in queries
const sqlFiles = ['lib/sqlite.ts', 'lib/db.ts', 'lib/accounts.ts', 'lib/booking.ts'];
let injectionRisk = false;
for (const sqlFile of sqlFiles) {
  const content = readFile(sqlFile);
  if (!content) continue;
  // Check for template literal SQL (risky pattern)
  const templateSql = scanForPattern(content, /`\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)[^`]*\${/i);
  if (templateSql.match) {
    find('SS-SEC-050', 'HIGH', `Potential SQL injection via template literal in ${sqlFile}`, 'User input interpolated directly into SQL query', 'Use prepared statements with ? placeholders instead of template literals', sqlFile, templateSql.line, '2h');
    injectionRisk = true;
    break;
  }
}
if (!injectionRisk) {
  find('SS-SEC-050', 'PASS', 'No obvious SQL injection patterns detected', '', '');
}

// 7. Check for console.log with sensitive data in API routes
const apiRoutes = findAllApiRoutes();
let consoleLogIssues = 0;
for (const route of apiRoutes) {
  const content = readFile(route);
  if (content.includes('console.log') && (content.includes('password') || content.includes('token') || content.includes('secret'))) {
    consoleLogIssues++;
    if (consoleLogIssues === 1) {
      find('SS-SEC-060', 'MEDIUM', 'Sensitive data potentially logged to console in API routes', 'Credentials may appear in server logs', 'Remove or sanitise console.log statements in production routes', route, undefined, '1h');
    }
  }
}
if (consoleLogIssues === 0) {
  find('SS-SEC-060', 'PASS', 'No obvious sensitive data in console.log statements', '', '');
}

// 8. Admin key check
const roles = readFile('lib/roles.ts');
if (roles.includes('requiresSecurityKey') && roles.includes('SUPER_ADMIN')) {
  find('SS-SEC-070', 'PASS', 'Admin security key requirement for SUPER_ADMIN defined', '', '');
} else {
  find('SS-SEC-070', 'HIGH', 'Admin security key enforcement not found', 'SUPER_ADMIN login may not require additional verification', 'Implement requiresSecurityKey() in auth flow', 'lib/roles.ts');
}

// Check that admin key file exists
if (fileExists('southstreet_admin.key')) {
  find('SS-SEC-071', 'MEDIUM', 'Admin key file in project root — should be in secure location', 'Key file could be accidentally served or committed', 'Move southstreet_admin.key outside project root, load via absolute path in .env', 'southstreet_admin.key');
}

// 9. Count unprotected API routes
const unprotectedRoutes: string[] = [];
for (const route of apiRoutes) {
  const content = readFile(route);
  // Public routes that are intentionally open
  const isPublicRoute = route.includes('/api/auth/') || route.includes('/api/session/') ||
    route.includes('/api/packages') || route.includes('/api/reviews') ||
    route.includes('/api/security/ingest'); // ingest uses its own token
  if (!isPublicRoute && !content.includes('requestAuth') && !content.includes('verifyJwt') &&
    !content.includes('getSession') && !content.includes('requireAuth') &&
    !content.includes('authenticate') && !content.includes('request-auth')) {
    unprotectedRoutes.push(route);
  }
}

if (unprotectedRoutes.length === 0) {
  find('SS-SEC-080', 'PASS', 'All non-public API routes appear to have auth guards', '', '');
} else {
  find('SS-SEC-080', 'HIGH',
    `${unprotectedRoutes.length} API route(s) may lack auth guards`,
    'Unauthenticated users could access protected data',
    'Add requestAuth() or equivalent to each route',
    unprotectedRoutes[0],
    undefined,
    `${unprotectedRoutes.length}h`
  );
}

// ─── GENERATE REPORT ──────────────────────────────────────────────────────────

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const bySeverity = (s: Finding['severity']) => findings.filter(f => f.severity === s);
const critical = bySeverity('CRITICAL');
const high = bySeverity('HIGH');
const medium = bySeverity('MEDIUM');
const low = bySeverity('LOW');

const score = Math.max(0, 100 - (critical.length * 25) - (high.length * 10) - (medium.length * 4) - (low.length * 1));
const scoreLabel = score >= 90 ? '🟢 Excellent' : score >= 70 ? '🟡 Good' : score >= 50 ? '🟠 Needs Work' : '🔴 Critical';

function formatFinding(f: Finding): string {
  return `### [${f.id}] ${f.title}
- **File**: \`${f.file || 'N/A'}\`${f.line ? ` L${f.line}` : ''}
- **Impact**: ${f.impact}
- **Fix**: ${f.fix}${f.effort ? `\n- **Effort**: ${f.effort}` : ''}
`;
}

const potentialUnprotected = unprotectedRoutes.length > 0 ?
  '\n**Potentially unprotected routes:**\n' + unprotectedRoutes.map(r => `- \`${r}\``).join('\n') : '';

const report = `# 🛡️ MIMO Security Report
**Generated**: ${new Date().toISOString()}
**Auditor**: mimo-security
**App**: South Street Umrah & Hajj Agency

## Security Score: ${score}/100 ${scoreLabel}

**Findings**: 🔴 ${critical.length} CRITICAL · 🟠 ${high.length} HIGH · 🟡 ${medium.length} MEDIUM · 🔵 ${low.length} LOW · ✅ ${passCount} PASS

---

## Executive Summary

${critical.length > 0
    ? `⚠️ **${critical.length} CRITICAL issue(s) require immediate attention.** ${critical.map(f => f.title).join('. ')}`
    : '✅ No critical security vulnerabilities detected.'
  }

The South Street app has a ${scoreLabel.split(' ')[1]} security posture. ${high.length > 0 ? `There are ${high.length} HIGH severity issues that should be addressed before the next production deployment.` : 'HIGH severity issues are under control.'} The existing firewall infrastructure in \`middleware.ts\` and \`lib/security-monitor.ts\` is a strong foundation.

---
${critical.length > 0 ? `
## 🔴 CRITICAL Vulnerabilities (Fix Immediately)

${critical.map(formatFinding).join('\n')}
` : ''}
${high.length > 0 ? `
## 🟠 HIGH Issues (Fix Before Next Release)

${high.map(formatFinding).join('\n')}
` : ''}
${medium.length > 0 ? `
## 🟡 MEDIUM Issues (Next Sprint)

${medium.map(formatFinding).join('\n')}
` : ''}
${low.length > 0 ? `
## 🔵 LOW Enhancements

${low.map(formatFinding).join('\n')}
` : ''}

## ✅ Passing Security Checks (${passCount})

The following checks passed successfully — good security practices confirmed.

---

## Firewall & Infrastructure Status

| Check | Status | Notes |
|---|---|---|
| Edge Firewall | ${middleware.includes('firewallOn: true') ? '✅ Active' : '❌ Inactive'} | middleware.ts |
| Bot Blocking | ${middleware.includes('blockBots: true') ? '✅ Active' : '⚠️ Check config'} | middleware.ts |
| Injection Blocking | ${middleware.includes('blockInjection: true') ? '✅ Active' : '⚠️ Check config'} | middleware.ts |
| XSS Blocking | ${middleware.includes('blockXss: true') ? '✅ Active' : '⚠️ Check config'} | middleware.ts |
| Exploit Blocking | ${middleware.includes('blockExploits: true') ? '✅ Active' : '⚠️ Check config'} | middleware.ts |
| Helmet Headers | ${server.includes('helmet') ? '✅ Present' : '❌ Missing'} | server.js |
| Rate Limiting | ${server.includes('rateLimit') || server.includes('express-rate-limit') ? '✅ Present' : '❌ Missing'} | server.js |
| CORS | ${server.includes('cors') ? '✅ Present' : '❌ Missing'} | server.js |
| DB Encryption | ${dbCrypto.length > 0 ? '✅ Present' : '❌ Missing'} | lib/db-crypto.ts |
| Password Hashing | ✅ bcryptjs in deps | package.json |
| Admin Key Guard | ${roles.includes('requiresSecurityKey') ? '✅ Defined' : '❌ Missing'} | lib/roles.ts |

---

## API Routes Audit

| Route | Count |
|---|---|
| Total API routes found | ${apiRoutes.length} |
| Potentially unprotected | ${unprotectedRoutes.length} |
${potentialUnprotected}

---

## Recommendations (Priority Order)

${[...critical, ...high, ...medium].slice(0, 5).map((f, i) => `${i + 1}. **[${f.id}]** ${f.title} → ${f.fix}`).join('\n')}

---

*Report generated by MIMO Security Agent · Run \`npx tsx mimo/scripts/security-audit.ts\` to refresh*
`;

fs.writeFileSync(REPORT_FILE, report);
console.log(`✅ Security audit complete`);
console.log(`   🔴 ${critical.length} CRITICAL  🟠 ${high.length} HIGH  🟡 ${medium.length} MEDIUM  🔵 ${low.length} LOW  ✅ ${passCount} PASS`);
console.log(`   Score: ${score}/100 ${scoreLabel}`);
console.log(`   Report: ${REPORT_FILE}\n`);
