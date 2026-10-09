# Deploying South Street on a VPS

One small Linux server runs everything: the Next.js app (PM2), Nginx with HTTPS
in front, the SQLite database file, uploads and nightly backups.

**Recommended server:** Ubuntu 24.04 LTS, 2 vCPU, 4 GB RAM, 40 GB disk, and a domain
name pointing to the server (an `A` record). HTTPS is required: Windows Hello / security
keys only work on `https://` sites.

---

## 1. First installation (once)

```bash
# System packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx ffmpeg build-essential python3 curl ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Firewall: only SSH and the web
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# App user and folders
sudo adduser --disabled-password --gecos "" southstreet
sudo mkdir -p /var/lib/south-street && sudo chown southstreet: /var/lib/south-street
sudo -iu southstreet
git clone https://github.com/<your-account>/<your-repo>.git app
cd app && chmod +x scripts/update.sh
```

### Environment (`/home/southstreet/app/.env`)

Copy your PC's `.env`, then change the values marked **VPS**:

| Variable | Value |
|---|---|
| `JWT_SECRET` | same as on the PC |
| `DB_ENCRYPTION_SECRET`, `DB_LOOKUP_SECRET` | **same as on the PC** — the database cannot be read without them |
| `DB_PATH` | **VPS**: `/var/lib/south-street/south_street.db` |
| `BACKUP_DIR` | **VPS**: `/var/lib/south-street/backups` |
| `WEBAUTHN_RP_ID` | **VPS**: `example.com` |
| `WEBAUTHN_ORIGINS`, `APP_ORIGIN` | **VPS**: `https://example.com` |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | your AI keys |
| `NODE_ENV` | `production` |

`chmod 600 .env` — only the app user may read it. Keep a copy of the three secrets in a
password manager: **losing `DB_ENCRYPTION_SECRET` means losing the data, backups included.**

### Bring your data from the PC

On the PC stop the app (`npm run stop`), then copy:

```bash
scp south_street.db           southstreet@SERVER:/var/lib/south-street/
scp -r public/images/uploads  southstreet@SERVER:app/public/images/
scp -r images/uploads         southstreet@SERVER:app/images/
```

### First start

```bash
npm ci
NEXT_DIST_DIR=.next-a npm run build && echo .next-a > .next-active
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # prints one sudo command: run it so the app starts after a reboot
curl http://127.0.0.1:3000/api/health
```

### Nginx + HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/south-street   # edit the domain inside
sudo ln -s /etc/nginx/sites-available/south-street /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
sudo nginx -t && sudo systemctl reload nginx
```

### Super Admin on the new domain

Security keys belong to a website address, so the key made on `localhost` does not work on
the domain. Create an activation link and open it on `https://example.com`:

```bash
npm run admin:recover -- --yes
```

---

## 2. Updating to a new version

On your PC: commit and push to GitHub as usual. On the server:

```bash
sudo -iu southstreet
cd app && ./scripts/update.sh
```

What it does, and why it is safe:

1. **Backs up** the database (`pre-update`).
2. Pulls the new code (`git pull --ff-only` — never overwrites server files).
3. Installs dependencies (`npm ci`).
4. **Builds into a second folder while the site keeps running** on the current one.
5. Switches with `pm2 reload` (a few seconds, no failed requests).
6. **Checks `/api/health`**; if the new version does not answer within ~90 s it
   **rolls back automatically** to the previous code and build.

Other forms:

```bash
./scripts/update.sh v1.4.0       # a specific tag / commit
./scripts/update.sh --rollback   # back to the version before the last update
```

### Version numbers (on your PC)

Every release gets a number `MAJOR.MINOR.PATCH` and a git tag. After committing your work:

```bash
npm run release -- patch --push    # 2.1.0 → 2.1.1  bug fixes
npm run release -- minor --push    # 2.1.0 → 2.2.0  new features
npm run release -- major --push    # 2.1.0 → 3.0.0  big changes
npm run release -- minor --dry-run # preview only
```

It updates `package.json`, writes a `CHANGELOG.md` section from your commit messages, commits
`release: vX.Y.Z`, tags `vX.Y.Z` and (with `--push`) sends both to GitHub. Then on the server:

```bash
./scripts/update.sh v2.2.0
```

The running version is shown at the bottom of the Super Admin menu and by `/api/health`.

Database changes need nothing extra: the app adds new tables / columns itself at start.

---

## 3. Backups and restore

* **Automatic:** every night at 03:00 (`south-street-backup` in PM2), the newest 14 are kept
  (`BACKUP_KEEP`). Each update also makes a `pre-update` backup.
* **Manual / download:** Super Admin dashboard → *النسخ الاحتياطية*, or `npm run db:backup`.
* **Off-server copy (strongly recommended):** copy `/var/lib/south-street/backups` to another
  place every day, e.g. with `rclone` to Google Drive / Backblaze, or download from the dashboard.
* **Restore:**

```bash
pm2 stop south-street
npm run db:restore -- south_street-YYYYMMDD-HHMMSS-auto.db.gz   # current DB is saved first
pm2 start south-street
```

---

## 4. Everyday commands

| Task | Command |
|---|---|
| Status | `pm2 status` |
| Logs | `pm2 logs south-street` (backup log: `logs/backup.log`) |
| Restart | `pm2 reload south-street` |
| Health | `curl http://127.0.0.1:3000/api/health` |
| Super Admin status | `npm run admin:status` |
| New activation link | `npm run admin:recover -- --yes` |
| Rotate DB secrets | `pm2 stop south-street && npm run db:rekey -- --generate && pm2 start south-street` |

Server hygiene: `sudo apt upgrade` monthly, enable automatic security updates
(`sudo apt install unattended-upgrades`), log in with SSH keys only.
