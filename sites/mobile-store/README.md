# Mobilo — SaaS for mobile phone shops

Multi-store platform at **https://mobile.1zayd1.tech**. Every store signs in with Google, manages its own data
(separated by `store_id` on every row, checked on every request), and gets a public catalogue at
`https://<store>.mobile.1zayd1.tech` (also `https://mobile.1zayd1.tech/s/<store>/`).

## Features
- **Sales (POS)**: search or scan with the camera (IMEI, barcode, QR), pick the exact phone by IMEI, discount, cash/card/CCP/BaridiMob/credit, change due, 80 mm receipt printing, refunds that put stock back.
- **Stock**: phones tracked one by one by IMEI (Luhn check, duplicate protection, trade-in back to stock), accessories by quantity, suppliers, movements history, low-stock alerts, CSV export.
- **Customers & credit**: debts per customer, payments, WhatsApp/call buttons.
- **Online orders**: the store page has an order form (cash on delivery style); orders turn into a sale in one click.
- **Reports**: sales, profit, expenses, net, by day / payment / seller / brand / product.
- **Team**: owner, manager, seller (sellers never see cost or profit). Invite by Gmail.
- **Themes**: Clean, Night, Souk, Luxe + accent colour, logo, cover, socials, AR/FR/EN.
- **QR sign-in**: open `/login` on the PC, scan the QR with the phone that is signed in, pick the matching number.
- **Admin** (`/admin`, e-mails in `SUPER_ADMIN_EMAILS`): all stores, plans and expiry, suspend/activate, users, activity log, announcement, sign-ups on/off.

## Speed
No framework and no npm dependencies (Node 22 built-in SQLite). Pages are server-rendered or a small vanilla JS app;
CSS/JS are served with brotli and content-hash URLs (cached for a year, plus nginx cache). Photos are resized and converted
to **WebP in the browser before upload** (1280 px + 480 px thumbnail, EXIF removed), so a 4 MB camera photo becomes ~50–150 KB.

## Run locally
```
cd sites/mobile-store
echo PUBLIC_URL=http://localhost:3300> .env & echo DEV_LOGIN=1>> .env & echo SUPER_ADMIN_EMAILS=admin@test.local>> .env
npm run dev          # http://localhost:3300 — /auth/dev?email=you@test.local signs in without Google
npm test             # end-to-end tests (stores isolation, IMEI sales, QR sign-in, storefront, uploads)
```
Store pages locally: `http://<slug>.localhost:3300/`.

## Deploy (from the PC)
```
SUPER_ADMIN_EMAILS=you@gmail.com bash sites/mobile-store/deploy/deploy.sh
```
On the VPS: user `mobilestore`, code `/home/mobilestore/app` (→ releases/, last 5 kept), settings `/home/mobilestore/.env`
(created once, never overwritten), data + daily backups `/var/lib/mobile-store`, service `mobile-store` (port 3300),
nginx `sites-available/mobile-store`, certificates by the `mobile-store-certs.timer` (every minute: main domain and
each new store get a Let's Encrypt certificate as soon as DNS points to the server).

### One-time setup
1. **DNS (Hostinger)**: `A mobile → 45.9.190.236` and `A *.mobile → 45.9.190.236`.
2. **Google sign-in**: Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web application).
   Authorised redirect URI: `https://mobile.1zayd1.tech/auth/google/callback`. Put the ID and secret in
   `/home/mobilestore/.env` (`GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`) then `systemctl restart mobile-store`.
