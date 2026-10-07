# Production readiness — South Street

Go / no-go notes for shipping the Next.js App Router app (`npm run build` + `npm run start`). Companion docs: `SERVER.md`, `ADMIN_SECURITY.md`, `ONLINE_CARD_PAY.md`, `SMOKE_CHECKLIST.md`, `SAKHR_SMART.md`.

## 1) Environment flags (safe defaults)

| Variable | Default | Meaning |
|----------|---------|---------|
| `REQUIRE_ADMIN_APPROVAL_FOR_NEW_USERS` | `false` | `true` = new self-serve / Google pilgrims stay `PENDING_APPROVAL` until admin approves. |
| `ONLINE_CARD_PAY_ENABLED` | `false` | `true` only after a real Stripe/CIB provider is wired (see `ONLINE_CARD_PAY.md`). |
| `PORT` | `3000` | HTTP listen port for `next start`. |
| `NODE_ENV` | `production` | Production mode. |
| `SAKHR_AI_PROVIDER` | `auto` | `auto` \| `pollinations` \| `gemini` \| `xai`. |
| `POLLINATIONS_ENABLED` | optional | External Sakhr fallback path. |

**Secrets (server `.env` only — never public / never commit):**

- `JWT_SECRET`, `DB_ENCRYPTION_SECRET`, `DB_LOOKUP_SECRET`, `SERVER_ENCRYPTION_KEY`
- `GEMINI_API_KEY` / `SAKHR_GEMINI_KEY`, `XAI_API_KEY` / `GROK_API_KEY`, `POLLINATIONS_API_KEY` (optional)
- Google: `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (public client id only; **no** client secret in the browser bundle)
- Admin file key (`southstreet_admin.key`) — offline step-2 for SUPER_ADMIN / AGENCY_MANAGER; **not** under `public/`

Copy from `.env.example`; fill values locally. Do not print secret values in logs, chat, or this doc.

## 2) Build & start

```bash
npm run build
npm run start
```

- Primary entry is **Next.js** (`next start`), not legacy `server.js` (see `SERVER.md`).
- After a successful build, restart the process bound to `:3000` so pilgrims hit the new bundle.
- Windows PowerShell tip: stop the old process with a variable name other than `$pid` (reserved), e.g. `$procId`.

## 3) Admin firewall

- Edge `middleware.ts` classifies traffic, rate-limits, and flushes events to security ingest.
- Defaults favor protection (firewall on; bots/scanners/injection/XSS/exploit blocks enabled).
- Operators tune allow/block lists from the admin Security center — verify policy after deploy.
- 401 on admin APIs = session expired; re-login (do not keep acting with a stale token).

## 4) Roles

Canonical login roles (`lib/roles.ts`):

- `SUPER_ADMIN`, `AGENCY_MANAGER`, `ACCOUNTANT`, `GUIDE_MURSHID`, `AGENCY_AGENT`, `PILGRIM_USER`

Portal mapping must keep working after deploy (`/admin` vs `/portal` tabs). Booking confirm remains an agency action even when pilgrim self-serve approval is open.

## 5) Image assets

- Marketing / hero / about WebP under `images/` must remain available via `public/images` (synced by `next.config.js` on build/start).
- Spot-check home hero, programs, and Kaaba media after deploy.
- Do not commit oversized raw dumps that are not referenced.

## 6) Secrets hygiene

- [ ] `.env` and `*.key` are gitignored and absent from `public/`
- [ ] Admin security key **not** embedded in client JS
- [ ] Sakhr replies scrub env/key patterns (server `sanitizeSakhrReply` + client `scrubSecretsFromReply`)
- [ ] No secrets in this readiness doc, tickets, or screenshots
- [ ] Rotate admin key only when every operator can receive the new file immediately (`ADMIN_SECURITY.md`)

## 7) Smoke checklist (condensed)

1. `npm run build` — clean for your changes  
2. Open `/` logged out — pages + images load  
3. Sign-in (password and/or Google) — role redirect works  
4. `/admin` — User Access + firewall/security views load (admin key offline)  
5. `/book` — wizard steps + package list  
6. Sakhr — agency question + clarifying fallback; no secret leakage  
7. Negatives — no secrets under `public/`; do not commit `.env`

Full list: `docs/SMOKE_CHECKLIST.md`. Sakhr-specific: `docs/SAKHR_SMART.md`.

## 8) Open risks

| Risk | Mitigation / status |
|------|---------------------|
| Online card pay not wired | Keep `ONLINE_CARD_PAY_ENABLED=false` until provider + `/api/payments` E2E tested |
| External AI (Pollinations/Gemini/xAI) optional / flaky | Trusted DB + knowledge files first; clarifying fallback if empty; never invent prices |
| SQLite single-node | Fine for agency scale; plan backups / encryption key escrow (`DB_ENCRYPTION_SECRET`) |
| Legacy `server.js` | Prefer `next start`; do not dual-run without a clear reason |
| Google OAuth origins | Must include every live origin (localhost + production domain) on the **same** client id |
| Admin key distribution | Offline file; lost key = locked SUPER_ADMIN/MANAGER step-2 |

## 9) Go / no-go template

**Date:** _______________  
**Build:** `npm run build` ☐ pass ☐ fail  
**Start :3000:** ☐ healthy  

| Gate | Go? |
|------|-----|
| Env flags reviewed (approval + card pay) | ☐ |
| Secrets not in public / not in replies | ☐ |
| Auth + role redirects OK | ☐ |
| Admin firewall reachable | ☐ |
| Booking path smoke OK | ☐ |
| Sakhr smart checklist OK | ☐ |
| Images render | ☐ |
| Open risks accepted / owners named | ☐ |

**Decision:** ☐ GO   ☐ NO-GO  

**Signed:** _______________  

**Notes:** _______________________________________________