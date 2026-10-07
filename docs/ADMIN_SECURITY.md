# Admin security — operational guidance

Short runbook for `/admin` operators. Do **not** paste secrets into chat, tickets, or the public site.

## Approval flags

- `REQUIRE_ADMIN_APPROVAL_FOR_NEW_USERS` (`.env`)
  - `false` (default): Google pilgrim signup can self-serve without PENDING_APPROVAL.
  - `true`: new accounts stay pending until an admin approves in **الموافقات**.
- Agency booking confirm (`/api/bookings/confirm`) still requires an admin/manager/agent action for demand confirmation — keep that path even when user approval is open.

## Keys & secrets (never in public)

- Admin file key (`.key`) is required for SUPER_ADMIN / AGENCY_MANAGER login step 2. Keep the file offline; never commit it; never embed it in client bundles.
- `SERVER_ENCRYPTION_KEY`, JWT secrets, Google OAuth client secrets, Gemini/xAI keys: server `.env` only.
- Do not print key material in UI toasts, logs shipped to the browser, or marketing pages.
- Rotate the admin security key from **حالة الخادم** only when you can redistribute the new `.key` file to every admin immediately.

## Rotate admin key

1. Sign in to `/admin` with the current key.
2. Open **حالة الخادم** → rotate key action (requires explicit confirm).
3. Download / save the new key file securely.
4. Invalidate old copies; next admin login needs the new file.

## Card pay flag

- `ONLINE_CARD_PAY_ENABLED` defaults to `false` — no live Stripe/CIB.
- See `docs/ONLINE_CARD_PAY.md` before enabling. Never put Stripe secret keys in the client.

## Session & realtime

- Admin KPI badges poll about every 10s while `/admin` is open; heartbeat remains ~45s.
- HTTP **401** on admin APIs means the session expired — re-login; do not keep acting with a stale token.
- Optional idle hint on the admin shell is advisory only and must **not** lock pilgrim portals.

## Destructive actions

- Reject user, revoke/suspend access, reject booking, delete content/Sakhr rules: confirm in the UI before the API call.
- Prefer suspend + IP block over silent deletes when investigating abuse.

## Checklist after deploy

- [ ] `.env` flags reviewed (approval + card pay)
- [ ] Admin `.key` not in git / not in `public/`
- [ ] `/admin` login + overview KPIs load
- [ ] Security center defaults to open/high-priority scope
- [ ] No secrets in browser network responses for public routes
