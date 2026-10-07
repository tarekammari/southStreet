# Server entrypoints

## Recommended (Next.js)

Production and local Next apps should use the Next.js server:

```bash
npm run build
npm run start
```

`next start` serves the App Router (`app/`), API routes under `app/api/**`, and middleware.

## Legacy `server.js`

`server.js` remains in the repo for historical / custom Node hosting experiments. It is **not** the primary way to run the current Next.js App Router application.

- Prefer `next start` (or your host's Next adapter, e.g. Vercel) for the live app.
- Keep `server.js` only if you still need a custom Node entry; do not delete it without confirming no deploy scripts reference it.
- SQLite and other server modules are designed to run inside Next route handlers / Node runtime, not exclusively behind `server.js`.

If you are unsure which entry your environment uses, check `package.json` scripts and your host's start command.
