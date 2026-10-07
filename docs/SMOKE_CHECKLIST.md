# Smoke checklist (manual)

Run after local cleanup / before release. No Playwright required.

## Build & lint

1. `npm run build` — must complete without errors you introduced.
2. `npm run lint` — fix easy issues in touched files.

## Auth & session

1. Open `/` logged out — marketing pages load; images (WebP) appear.
2. Sign in (password or Google if configured) — token stored; redirect by role works.
3. Admin (`/admin`) — User Access dashboard loads; heartbeat keeps you “online”.
4. Portal (`/portal`) — role tabs match `lib/roles.ts` expectations.
5. Sign out — session cleared; protected fetches fail closed.

## Booking

1. `/book` — BookingWizard steps navigate; package list loads.
2. Submit a booking (or draft) — API URLs unchanged; confirmation / pending bag updates.
3. Print button (if used) still fetches with auth.

## Sakhr AI

1. Open Sakhr on portal/book — chat UI opens.
2. Ask a simple agency question — response returns (local RAG and/or external).
3. Admin table tools (if admin) — cards/actions still appear; no console crash.

## Images / assets

1. Home hero / about / programs — WebP marketing images render.
2. Kaaba video (if used) still plays from `/images/...`.
3. Confirm `images/` still syncs to `public/images` via `next.config.js` on next build/start.

## Negatives

1. No secrets under `public/`.
2. Legacy `js/` / `css/` folders are archived (not required by App Router).
3. Git status dirty is OK — do not commit `.env` or keys.
