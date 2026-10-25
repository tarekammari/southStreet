# Several agencies on one VPS

Each agency gets its **own South Street**: its own database, secrets, uploads, admins and
web address. They share only the server (Node, Nginx, PM2, certbot) and the owner's
backup key. The first install (South Street itself, from [HOSTINGER.md](HOSTINGER.md))
stays exactly where it is and counts as agency `southstreet`.

| | first install (`southstreet`) | every other agency (`<slug>`) |
|---|---|---|
| Linux user | `southstreet` | `ss-<slug>` |
| Code, `.env`, uploads | `/home/southstreet/app` | `/home/ss-<slug>/app` |
| Database + backups | `/var/lib/south-street/` | `/var/lib/south-street/<slug>/` |
| Port | 3000 | 3101, 3102, … (first free) |
| PM2 processes | `south-street`, `south-street-backup`, … | `south-street-<slug>`, `south-street-<slug>-backup`, … |
| Nginx site | `south-street` (by `hostinger-setup.sh`) | `south-street-<slug>` |
| Address | `southstreet.1zayd1.tech` | `<slug>.1zayd1.tech`, then its own domain |

**Why one checkout per agency** (and not one shared release): it is the same layout as
the first install, so `scripts/update.sh` (backup, build beside the running site,
zero-downtime switch, health check, rollback) works for each agency unchanged; uploaded
images live inside the app folder, so they stay separate; one agency can stay on an
older version or be rolled back alone; and Linux permissions keep each agency's `.env`
and data out of the others' reach. The cost is disk (≈1.5 GB per agency) and one build
per agency on each update (3–6 minutes each, one after the other).

The registry of agencies is `/etc/south-street/agencies/<slug>.env` (root only).

## Before the first agency

1. **DNS at Hostinger** (hPanel → Domains → `1zayd1.tech` → DNS records), once:

   | Type | Name | Points to | TTL |
   |---|---|---|---|
   | A | `*` | `45.9.190.236` | 3600 |

   The wildcard makes every `<slug>.1zayd1.tech` reach the VPS. Do not add an `AAAA`
   record unless it is the VPS's own IPv6 (Let's Encrypt tries IPv6 first).
2. **Backup key**: the owner's public key goes to `/etc/south-street/backup-public.pem`
   (the first run copies it from the first install's `BACKUP_PUBLIC_KEY_FILE` if it is not
   there). Every agency's backups are encrypted to it; only the private key on your PC
   opens them.
3. **Optional: vendor-wide keys** for every new agency, in
   `/etc/south-street/agency-defaults.env` (root only, `chmod 600`), for example:

   ```bash
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   FIREBASE_SERVICE_ACCOUNT_B64=...
   ```

   They are copied into a new agency's `.env` once, before its first build. AI keys shared
   this way share their daily quota between agencies.
4. The scripts are in the app's `deploy/` folder; run them as root from any up-to-date
   checkout, e.g. `cd /home/southstreet/app` after updating it.

## Add an agency

```bash
bash deploy/agency-add.sh acme
bash deploy/agency-add.sh acme --domain www.acme-voyages.dz   # its own domain from the start
```

Options: `--ref v1.7.0` (version to install, default `main`), `--email you@mail` (Let's
Encrypt and push notification contact).

It creates the user, downloads and builds the app, writes a `.env` with **fresh secrets**
(JWT, database encryption and lookup keys, notification keys), starts PM2, issues the
certificates and writes the Nginx site. Running it again repairs what is missing and
never replaces secrets, database or uploads.

Then, **once the final domain is settled**, create the agency's one Super Admin:

```bash
sudo -iu ss-acme bash -lc 'cd app && npm run admin:setup'
```

Open the printed link on the agency's address, set a password, add two security keys.

> Security keys belong to one web address. If the agency will move to its own domain,
> move it **before** this step, or every admin registers their keys again afterwards.

Save `/home/ss-acme/app/.env` in your password manager: without its secrets the
agency's database and backups cannot be read.

## Move an agency to its own domain

1. The agency (or you) adds at its domain registrar:

   | Type | Name | Points to |
   |---|---|---|
   | A | `www` | `45.9.190.236` |
   | A | `@` (the bare domain, optional) | `45.9.190.236` |

   and removes any `AAAA` record. Wait until `getent hosts www.acme-voyages.dz` on the VPS
   shows `45.9.190.236`.
2. Run:

   ```bash
   bash deploy/agency-domain.sh acme www.acme-voyages.dz
   ```

   It checks the DNS, issues the certificates, sets `APP_ORIGIN`, `WEBAUTHN_RP_ID`,
   `WEBAUTHN_ORIGINS` and `ALLOWED_ORIGINS`, rebuilds the same version (page links
   carry the address) with a zero-downtime switch, and rewrites the Nginx site.
   `acme.1zayd1.tech` (and `acme-voyages.dz` when it points to the VPS) keep working and
   forward to `https://www.acme-voyages.dz`. If the rebuild fails, the old settings are
   put back and nothing changes.
3. **Security keys must be registered again** (the script says it in red):
   `sudo -iu ss-acme bash -lc 'cd app && npm run admin:recover -- --yes'` gives the Super
   Admin a new link; the Super Admin then resets each Admin's keys from the staff
   accounts page.

The first install moves with its own script instead:
`DOMAIN=www.southstreet.dz bash deploy/hostinger-setup.sh`.

## Google sign-in

All agencies can use the same Google OAuth client (Google Cloud Console → APIs & Services
→ Credentials → the client → **Authorized JavaScript origins**). Add every address
customers sign in on, exactly, with `https://` and no trailing slash:

```
https://southstreet.1zayd1.tech
https://acme.1zayd1.tech
https://www.acme-voyages.dz
```

Add the agency's own domain when it moves; the old `*.1zayd1.tech` entry can stay. Each
entry takes a few minutes to work. An agency may also use its own client: put its IDs
in that agency's `.env` and rebuild (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is built in).

## Update all agencies

```bash
bash deploy/agencies-update.sh            # latest commit of each install's branch
bash deploy/agencies-update.sh v1.7.0     # the same version everywhere (recommended)
```

`southstreet` goes first, then the others by name, one at a time, each with
`scripts/update.sh`. At the first agency that fails to build or does not answer, that
agency is rolled back and the script **stops**: the agencies after it are not touched,
and the message lists which ones were updated. After a rollback an install is on a fixed
commit, so the next run needs a version (`… agencies-update.sh main`).

One agency alone: `sudo -iu ss-acme bash -lc 'cd app && ./scripts/update.sh v1.7.0'`.

## See them all

```bash
bash deploy/agency-list.sh
```

```
SLUG             PORT   VERSION          APP    HTTPS  MEMORY   DOMAINS
southstreet      3000   1.6.1 4b7e9a2    ok     ok     312 MB   southstreet.1zayd1.tech
acme             3101   1.6.1 4b7e9a2    ok     ok     287 MB   www.acme-voyages.dz (acme.1zayd1.tech →)
```

`APP` is the app on its port, `HTTPS` the public address through Nginx.

## Memory and size

- About **300 MB per agency** while running (Next.js server), plus ~40 MB for each
  agency's own PM2. Nightly backups and the official-updates check run for a minute
  each, 5 minutes apart per agency (`BACKUP_CRON`, `OFFICIAL_UPDATES_CRON` in `.env`).
- A build needs 1.5–2.5 GB for a few minutes; updates build one agency at a time.
- On the KVM 2 (8 GB RAM, 2 GB swap): keep ~2.5 GB free for builds, so **about 12–15
  agencies**; watch `agency-list.sh`'s "Server memory" line, and move to a bigger VPS
  before it drops under 2 GB available.
- Disk: ≈1.5 GB per agency for code and builds, plus its database, uploads and 14 backups.

## Everyday commands for one agency

```bash
sudo -iu ss-acme pm2 logs south-street-acme          # live logs
sudo -iu ss-acme pm2 restart south-street-acme       # restart
sudo -iu ss-acme bash -lc 'cd app && npm run admin:status'
sudo -iu ss-acme bash -lc 'cd app && npm run db:backup'
```

Restore: as in [DEPLOY.md](../DEPLOY.md) §3, as the agency's user, with
`pm2 stop south-street-acme` / `pm2 start south-street-acme`.

## Remove an agency (by hand, on purpose)

```bash
sudo -iu ss-acme pm2 delete all && sudo -iu ss-acme pm2 save
rm /etc/nginx/sites-enabled/south-street-acme && systemctl reload nginx
rm /etc/south-street/agencies/acme.env
# keep /var/lib/south-street/acme/backups (and the .env in your password manager) as long as needed
```
