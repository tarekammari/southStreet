# 🔐 MIMO Auth Report
**Generated**: 2026-09-13T20:07:12.152Z
**Auditor**: mimo-auth
**App**: South Street Umrah & Hajj Agency

## Auth Security Score: 58/100 🟠 Needs Work

**Findings**: 🔴 0 CRITICAL · 🟠 3 HIGH · 🟡 3 MEDIUM · 🔵 0 LOW · ✅ 11 PASS

---

## Executive Summary

✅ No critical auth vulnerabilities detected.
There are 3 HIGH severity issues to address before the next production deployment.

The auth architecture uses JWT tokens, Google OAuth, and a role-based access system with 6 roles. The existing middleware provides a strong foundation.

---

## Auth Flow Diagram

```
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
```

---

## 🟠 HIGH Issues

### [SS-AUTH-041] Session data stored in localStorage
- **File**: `lib/client-session.ts`
- **Impact**: XSS attacks can steal session tokens from localStorage
- **Fix**: Use HttpOnly cookies for session tokens instead of localStorage

### [SS-AUTH-050] HttpOnly cookie flag not detected in middleware
- **File**: `middleware.ts`
- **Impact**: Session cookies accessible via JavaScript (XSS risk)
- **Fix**: Add HttpOnly flag to all auth cookies

### [SS-AUTH-060] 9 API route(s) may lack auth guards
- **File**: `app/api/admin/auth/route.ts`
- **Impact**: Unauthenticated users could access or modify protected data
- **Fix**: Add requestAuth() to each unprotected route

## 🟡 MEDIUM Issues

### [SS-AUTH-003] JWT algorithm not explicitly configured
- **File**: `lib/auth.ts`
- **Impact**: May default to insecure algorithm
- **Fix**: Explicitly set algorithm: 'HS256'

### [SS-AUTH-042] SessionGuard may not redirect correctly
- **File**: `components/SessionGuard.tsx`
- **Impact**: Protected pages may be partially accessible without auth
- **Fix**: Ensure SessionGuard redirects to login when no session

### [SS-AUTH-051] SameSite cookie attribute not found
- **File**: `middleware.ts`
- **Impact**: Cookies may be sent with cross-site requests (CSRF risk)
- **Fix**: Set SameSite=Strict or SameSite=Lax on auth cookies



---

## RBAC Matrix (40 routes)

| Route | Methods | Guard | Status |
|---|---|---|---|
| `app/api/account/avatar/route.ts` | GET | ✅ Auth guard | ✅ Protected |
| `app/api/account/me/route.ts` | GET | ✅ Auth guard | ✅ Protected |
| `app/api/account/security/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/admin/agency/route.ts` | GET, PUT | ✅ Auth guard | ✅ Protected |
| `app/api/admin/auth/route.ts` | POST | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/admin/content/route.ts` | GET, POST, PUT, DELETE | ✅ Auth guard | ✅ Protected |
| `app/api/admin/credentials/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/admin/db-tables/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/admin/google-auth/route.ts` | GET, PUT | ✅ Auth guard | ✅ Protected |
| `app/api/admin/hotels/route.ts` | GET, POST, DELETE | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/admin/morshids/route.ts` | GET, POST, DELETE | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/admin/packages/route.ts` | GET, POST, PUT, DELETE | ✅ Auth guard | ✅ Protected |
| `app/api/admin/reviews/route.ts` | GET, PATCH | ✅ Auth guard | ✅ Protected |
| `app/api/admin/sakhr-knowledge/route.ts` | GET, POST, PUT, DELETE | ✅ Auth guard | ✅ Protected |
| `app/api/admin/sakhr-learn-url/route.ts` | POST | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/admin/seasons/route.ts` | GET, POST, DELETE | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/admin/security-key/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/admin/server-health/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/admin/upload-image/route.ts` | POST | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/admin/users/route.ts` | GET, POST, PATCH, DELETE | ✅ Auth guard | ✅ Protected |
| `app/api/ai/sakhr/route.ts` | POST | 🔓 Public (intentional) | ✅ Public |
| `app/api/audit/route.ts` | GET | ⚠️ No guard detected | ⚠️ Check needed |
| `app/api/auth/config/route.ts` | GET | 🔓 Public (intentional) | ✅ Public |
| `app/api/auth/connect/route.ts` | POST | 🔓 Public (intentional) | ✅ Public |
| `app/api/auth/google/route.ts` | POST | 🔓 Public (intentional) | ✅ Public |
| `app/api/auth/logout/route.ts` | POST | 🔓 Public (intentional) | ✅ Public |
| `app/api/auth/register/route.ts` | POST | 🔓 Public (intentional) | ✅ Public |
| `app/api/bookings/confirm/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/bookings/document/route.ts` | GET, POST | ✅ Auth guard | ✅ Protected |
| `app/api/bookings/route.ts` | GET, POST, PUT, DELETE | ✅ Auth guard | ✅ Protected |

*...and 10 more routes*

### ⚠️ Routes Needing Review
- `app/api/admin/auth/route.ts`
- `app/api/admin/hotels/route.ts`
- `app/api/admin/morshids/route.ts`
- `app/api/admin/sakhr-learn-url/route.ts`
- `app/api/admin/seasons/route.ts`
- `app/api/admin/upload-image/route.ts`
- `app/api/audit/route.ts`
- `app/api/staff-image/[filename]/route.ts`
- `app/api/users/route.ts`

---

## Role Access Summary

| Role | Code | Portal Path | Requires Key |
|---|---|---|---|
| مدير النظام العام | `SUPER_ADMIN` | `/admin` | ✅ Yes |
| مدير الوكالة | `AGENCY_MANAGER` | `/admin` | ❌ No |
| محاسب الوكالة | `ACCOUNTANT` | `/portal?tab=accountant` | ❌ No |
| مرشد ديني | `GUIDE_MURSHID` | `/portal?tab=murshid` | ❌ No |
| موظف الوكالة | `AGENCY_AGENT` | `/portal?tab=agent` | ❌ No |
| معتمر / حاج | `PILGRIM_USER` | `/portal?tab=program` | ❌ No |

---

## Cookie Security Checklist

| Flag | Status |
|---|---|
| HttpOnly | ⚠️ Not detected |
| Secure | ⚠️ Not detected |
| SameSite | ⚠️ Not detected |
| No localStorage | ❌ localStorage used |

---

## ✅ Passing Checks (11)

All other auth checks passed successfully.

---

*Report generated by MIMO Auth Agent · Run `npx tsx mimo/scripts/auth-audit.ts` to refresh*
