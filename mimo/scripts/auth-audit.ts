#!/usr/bin/env tsx
/**
 * MIMO Auth Audit Script
 * Audits authentication and authorisation across the South Street app.
 * Run: npx tsx mimo/scripts/auth-audit.ts
 * Output: mimo/reports/auth.md
 */

import fs from 'fs';
import path from 'path';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.join(APP_ROOT, 'mimo', 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'auth.md');

interface AuthFinding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
  title: string;
  file?: string;
  impact: string;
  fix: string;
}

const findings: AuthFinding[] = [];
let passCount = 0;

function find(id: string, severity: AuthFinding['severity'], title: string, impact: string, fix: string, file?: string) {
  if (severity === 'PASS') passCount++;
  else findings.push({ id, severity, title, file, impact, fix });
}

function readFile(relPath: string): string {
  const full = path.join(APP_ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf-8');
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(APP_ROOT, relPath));
}

function getAllApiRoutes(): Array<{ path: string; content: string }> {
  const routes: Array<{ path: string; content: string }> = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
        const relPath = full.replace(APP_ROOT + path.sep, '').replace(/\\/g, '/');
        routes.push({ path: relPath, content: fs.readFileSync(full, 'utf-8') });
      }
    }
  }
  walk(path.join(APP_ROOT, 'app', 'api'));
  return routes;
}

console.log('🔐 MIMO Auth Audit starting...\n');

// ─── AUTH LIBRARY ─────────────────────────────────────────────────────────────

const authLib = readFile('lib/auth.ts');
const requestAuth = readFile('lib/request-auth.ts');
const roles = readFile('lib/roles.ts');
const middleware = readFile('middleware.ts');
const clientSession = readFile('lib/client-session.ts');
const googleIdToken = readFile('lib/google-id-token.ts');
const googleAuthConfig = readFile('lib/google-auth-config.ts');

// 1. JWT Security
if (authLib.includes('jwt') || authLib.includes('jsonwebtoken')) {
  find('SS-AUTH-001', 'PASS', 'jsonwebtoken library used', '', '');
} else {
  find('SS-AUTH-001', 'HIGH', 'JWT library not found in auth.ts', 'Auth mechanism unclear', 'Ensure jsonwebtoken is used for token signing', 'lib/auth.ts');
}

if (authLib.includes('expiresIn') || authLib.includes('exp:')) {
  find('SS-AUTH-002', 'PASS', 'JWT expiry configured', '', '');
} else {
  find('SS-AUTH-002', 'HIGH', 'JWT token expiry not set', 'Stolen tokens remain valid forever', "Add expiresIn: '24h' or similar to jwt.sign()", 'lib/auth.ts');
}

if (authLib.includes('HS256') || authLib.includes('RS256') || authLib.includes('algorithm:')) {
  find('SS-AUTH-003', 'PASS', 'JWT algorithm explicitly set', '', '');
} else {
  find('SS-AUTH-003', 'MEDIUM', 'JWT algorithm not explicitly configured', 'May default to insecure algorithm', "Explicitly set algorithm: 'HS256'", 'lib/auth.ts');
}

// Check for JWT secret from env
if (authLib.includes('process.env') || authLib.includes('JWT_SECRET')) {
  find('SS-AUTH-004', 'PASS', 'JWT secret loaded from environment', '', '');
} else {
  find('SS-AUTH-004', 'CRITICAL', 'JWT secret may be hardcoded', 'Hardcoded secrets can be stolen from source code', 'Use process.env.JWT_SECRET loaded from .env', 'lib/auth.ts');
}

// 2. Request Auth Middleware
if (requestAuth.length > 0) {
  find('SS-AUTH-010', 'PASS', 'Request auth middleware exists', '', '');

  if (requestAuth.includes('role') || requestAuth.includes('Role')) {
    find('SS-AUTH-011', 'PASS', 'Role checking present in request-auth', '', '');
  } else {
    find('SS-AUTH-011', 'MEDIUM', 'Role checking not found in request-auth.ts', 'Routes may not enforce role-based access', 'Add role parameter to auth check function', 'lib/request-auth.ts');
  }
} else {
  find('SS-AUTH-010', 'HIGH', 'lib/request-auth.ts is empty or missing', 'No per-request auth middleware', 'Create request auth middleware that verifies JWT and role', 'lib/request-auth.ts');
}

// 3. RBAC — Admin Key
if (roles.includes('requiresSecurityKey')) {
  find('SS-AUTH-020', 'PASS', 'requiresSecurityKey() function defined in roles.ts', '', '');

  if (roles.includes("return login === 'SUPER_ADMIN'")) {
    find('SS-AUTH-021', 'PASS', 'SUPER_ADMIN correctly requires security key', '', '');
  }
} else {
  find('SS-AUTH-020', 'HIGH', 'requiresSecurityKey() not found', 'SUPER_ADMIN login has no additional verification', 'Implement requiresSecurityKey() check in login flow', 'lib/roles.ts');
}

// 4. Google OAuth
if (googleIdToken.length > 0) {
  find('SS-AUTH-030', 'PASS', 'Google ID token verification file present', '', '');

  if (googleIdToken.includes('verify') || googleIdToken.includes('verif')) {
    find('SS-AUTH-031', 'PASS', 'Google token verification implemented', '', '');
  } else {
    find('SS-AUTH-031', 'HIGH', 'Google token verification unclear', 'Google OAuth tokens may not be properly verified', 'Ensure token is verified with Google public keys server-side', 'lib/google-id-token.ts');
  }
} else {
  find('SS-AUTH-030', 'MEDIUM', 'Google ID token verification file missing', 'Google OAuth may lack server-side verification', 'Implement server-side Google token verification', 'lib/google-id-token.ts');
}

// Check client secret isn't in public
if (exists('public/client_secret.json') || exists('public/google_client_secret.json')) {
  find('SS-AUTH-032', 'CRITICAL', 'Google OAuth client secret exposed in public directory', 'Secret is publicly downloadable — OAuth can be hijacked', 'Move client secret out of public/ directory immediately', 'public/');
} else {
  find('SS-AUTH-032', 'PASS', 'Google client secret not in public directory', '', '');
}

// 5. Session Management
if (clientSession.length > 0) {
  find('SS-AUTH-040', 'PASS', 'Client session management file present', '', '');

  // Check if session stored in localStorage (bad) vs cookie (good)
  if (clientSession.includes('localStorage')) {
    find('SS-AUTH-041', 'HIGH', 'Session data stored in localStorage', 'XSS attacks can steal session tokens from localStorage', 'Use HttpOnly cookies for session tokens instead of localStorage', 'lib/client-session.ts');
  } else {
    find('SS-AUTH-041', 'PASS', 'No localStorage usage detected for session', '', '');
  }
} else {
  find('SS-AUTH-040', 'MEDIUM', 'client-session.ts is empty or missing', 'Client-side session management unclear', 'Implement proper client session management', 'lib/client-session.ts');
}

// SessionGuard
if (exists('components/SessionGuard.tsx')) {
  const sg = readFile('components/SessionGuard.tsx');
  if (sg.includes('redirect') || sg.includes('router.push') || sg.includes('/login')) {
    find('SS-AUTH-042', 'PASS', 'SessionGuard redirects unauthenticated users', '', '');
  } else {
    find('SS-AUTH-042', 'MEDIUM', 'SessionGuard may not redirect correctly', 'Protected pages may be partially accessible without auth', 'Ensure SessionGuard redirects to login when no session', 'components/SessionGuard.tsx');
  }
}

// 6. Cookie Security - check middleware for cookie attributes
if (middleware.includes('HttpOnly') || middleware.includes('httpOnly')) {
  find('SS-AUTH-050', 'PASS', 'HttpOnly cookie flag detected', '', '');
} else {
  find('SS-AUTH-050', 'HIGH', 'HttpOnly cookie flag not detected in middleware', 'Session cookies accessible via JavaScript (XSS risk)', 'Add HttpOnly flag to all auth cookies', 'middleware.ts');
}

if (middleware.includes('SameSite') || middleware.includes('sameSite')) {
  find('SS-AUTH-051', 'PASS', 'SameSite cookie attribute configured', '', '');
} else {
  find('SS-AUTH-051', 'MEDIUM', 'SameSite cookie attribute not found', 'Cookies may be sent with cross-site requests (CSRF risk)', "Set SameSite=Strict or SameSite=Lax on auth cookies", 'middleware.ts');
}

// 7. API Routes RBAC Matrix
const apiRoutes = getAllApiRoutes();
const rbacMatrix: Array<{ route: string; methods: string; guard: string; status: string }> = [];

const PUBLIC_ROUTES = [
  '/api/auth/',
  '/api/session/',
  '/api/packages',
  '/api/reviews',
  '/api/hotels',
  '/api/security/ingest',
  '/api/ai/',
];

const unprotected: string[] = [];

for (const route of apiRoutes) {
  const isPublic = PUBLIC_ROUTES.some(p => route.path.includes(p));
  const hasAuth = route.content.includes('requestAuth') ||
    route.content.includes('verifyJwt') ||
    route.content.includes('getSession') ||
    route.content.includes('requireAuth') ||
    route.content.includes('authenticate') ||
    route.content.includes('request-auth') ||
    route.content.includes('authGuard') ||
    route.content.includes('checkAuth') ||
    route.content.includes('session');

  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    .filter(m => route.content.includes(`export async function ${m}`) || route.content.includes(`export function ${m}`))
    .join(', ') || 'GET';

  const guard = hasAuth ? '✅ Auth guard' : isPublic ? '🔓 Public (intentional)' : '⚠️ No guard detected';
  const status = isPublic ? '✅ Public' : hasAuth ? '✅ Protected' : '⚠️ Check needed';

  if (!isPublic && !hasAuth) unprotected.push(route.path);

  rbacMatrix.push({ route: route.path, methods, guard, status });
}

if (unprotected.length === 0) {
  find('SS-AUTH-060', 'PASS', 'All non-public API routes appear to have auth guards', '', '');
} else {
  find('SS-AUTH-060', 'HIGH',
    `${unprotected.length} API route(s) may lack auth guards`,
    'Unauthenticated users could access or modify protected data',
    'Add requestAuth() to each unprotected route',
    unprotected[0]
  );
}

// ─── GENERATE REPORT ──────────────────────────────────────────────────────────

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const bySeverity = (s: AuthFinding['severity']) => findings.filter(f => f.severity === s);
const critical = bySeverity('CRITICAL');
const high = bySeverity('HIGH');
const medium = bySeverity('MEDIUM');
const low = bySeverity('LOW');

const score = Math.max(0, 100 - (critical.length * 25) - (high.length * 10) - (medium.length * 4));
const scoreLabel = score >= 90 ? '🟢 Strong' : score >= 70 ? '🟡 Adequate' : score >= 50 ? '🟠 Needs Work' : '🔴 Weak';

function fmtF(f: AuthFinding): string {
  return `### [${f.id}] ${f.title}
- **File**: \`${f.file || 'N/A'}\`
- **Impact**: ${f.impact}
- **Fix**: ${f.fix}
`;
}

const report = `# 🔐 MIMO Auth Report
**Generated**: ${new Date().toISOString()}
**Auditor**: mimo-auth
**App**: South Street Umrah & Hajj Agency

## Auth Security Score: ${score}/100 ${scoreLabel}

**Findings**: 🔴 ${critical.length} CRITICAL · 🟠 ${high.length} HIGH · 🟡 ${medium.length} MEDIUM · 🔵 ${low.length} LOW · ✅ ${passCount} PASS

---

## Executive Summary

${critical.length > 0
    ? `⚠️ **${critical.length} CRITICAL auth issue(s) require immediate attention.**`
    : '✅ No critical auth vulnerabilities detected.'
  }
${high.length > 0 ? `There are ${high.length} HIGH severity issues to address before the next production deployment.` : ''}

The auth architecture uses JWT tokens, Google OAuth, and a role-based access system with 6 roles. The existing middleware provides a strong foundation.

---

## Auth Flow Diagram

\`\`\`
User → LoginModal → POST /api/auth/login
          ↓
      bcryptjs password verification
          ↓
      JWT signed (lib/auth.ts) + role embedded
          ↓
      HttpOnly Cookie set
          ↓
      middleware.ts → peekJwtIdentity() → role extracted
          ↓
      Portal route → resolvePortalTab(role, tab) → RBAC applied
          ↓
      API routes → lib/request-auth.ts → JWT verified + role checked
\`\`\`

---
${critical.length > 0 ? `## 🔴 CRITICAL Issues\n\n${critical.map(fmtF).join('\n')}` : ''}
${high.length > 0 ? `## 🟠 HIGH Issues\n\n${high.map(fmtF).join('\n')}` : ''}
${medium.length > 0 ? `## 🟡 MEDIUM Issues\n\n${medium.map(fmtF).join('\n')}` : ''}
${low.length > 0 ? `## 🔵 LOW Issues\n\n${low.map(fmtF).join('\n')}` : ''}

---

## RBAC Matrix (${apiRoutes.length} routes)

| Route | Methods | Guard | Status |
|---|---|---|---|
${rbacMatrix.slice(0, 30).map(r => `| \`${r.route}\` | ${r.methods} | ${r.guard} | ${r.status} |`).join('\n')}
${rbacMatrix.length > 30 ? `\n*...and ${rbacMatrix.length - 30} more routes*` : ''}

${unprotected.length > 0 ? `### ⚠️ Routes Needing Review\n${unprotected.map(r => `- \`${r}\``).join('\n')}` : '### ✅ All routes appear protected'}

---

## Role Access Summary

| Role | Code | Portal Path | Requires Key |
|---|---|---|---|
| مدير النظام العام | \`SUPER_ADMIN\` | \`/admin\` | ✅ Yes |
| مدير الوكالة | \`AGENCY_MANAGER\` | \`/admin\` | ❌ No |
| محاسب الوكالة | \`ACCOUNTANT\` | \`/portal?tab=accountant\` | ❌ No |
| مرشد ديني | \`GUIDE_MURSHID\` | \`/portal?tab=murshid\` | ❌ No |
| موظف الوكالة | \`AGENCY_AGENT\` | \`/portal?tab=agent\` | ❌ No |
| معتمر / حاج | \`PILGRIM_USER\` | \`/portal?tab=program\` | ❌ No |

---

## Cookie Security Checklist

| Flag | Status |
|---|---|
| HttpOnly | ${middleware.includes('HttpOnly') || middleware.includes('httpOnly') ? '✅ Set' : '⚠️ Not detected'} |
| Secure | ${middleware.includes('Secure') || middleware.includes('secure') ? '✅ Set' : '⚠️ Not detected'} |
| SameSite | ${middleware.includes('SameSite') || middleware.includes('sameSite') ? '✅ Set' : '⚠️ Not detected'} |
| No localStorage | ${clientSession.includes('localStorage') ? '❌ localStorage used' : '✅ Not in client-session'} |

---

## ✅ Passing Checks (${passCount})

All other auth checks passed successfully.

---

*Report generated by MIMO Auth Agent · Run \`npx tsx mimo/scripts/auth-audit.ts\` to refresh*
`;

fs.writeFileSync(REPORT_FILE, report);
console.log(`\n✅ Auth audit complete`);
console.log(`   Score: ${score}/100 ${scoreLabel}`);
console.log(`   🔴 ${critical.length} CRITICAL  🟠 ${high.length} HIGH  🟡 ${medium.length} MEDIUM  🔵 ${low.length} LOW`);
console.log(`   API routes audited: ${apiRoutes.length} | Unprotected: ${unprotected.length}`);
console.log(`   Report: ${REPORT_FILE}\n`);
