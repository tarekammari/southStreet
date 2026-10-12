# South Street on a Hostinger VPS

One script installs everything (Node, PM2, Nginx, HTTPS, firewall, backups) and starts the
app. It works with the server name Hostinger gives you (`srvXXXXXXX.hstgr.cloud`, already
pointing to the VPS), so the site has real HTTPS before you buy a domain.

## 1. Prepare your data on the PC

`deploy-upload/` (never committed) holds `.env`, a clean copy of `south_street.db` and
`uploads.tgz` (uploaded images). Recreate it any time from the project folder:

```bash
mkdir -p deploy-upload
node -e "new (require('better-sqlite3'))('south_street.db',{readonly:true}).backup('deploy-upload/south_street.db')"
cp .env deploy-upload/.env
tar -czf deploy-upload/uploads.tgz images/uploads public/images/uploads
```

## 2. First run on the server

hPanel → VPS → **Browser terminal** (logged in as root):

```bash
curl -fsSL https://raw.githubusercontent.com/tarekammari/southStreet/main/deploy/hostinger-setup.sh -o setup.sh
bash setup.sh
```

It installs the system, downloads the app, then stops and prints the upload command.

## 3. Upload the data (PowerShell on the PC)

```powershell
cd D:\data\south_street\deploy-upload
scp .env south_street.db uploads.tgz root@SERVER-IP:/root/upload/
```

## 4. Second run on the server

```bash
bash setup.sh
```

It builds and starts the app, sets up Nginx + HTTPS, and prints the site address.

## 5. Super Admin

Security keys belong to a web address, so register them again on the new one:

```bash
sudo -iu southstreet bash -lc 'cd app && npm run admin:recover -- --yes'
```

Open the printed link, set the password, add at least two keys.

## 6. Vercel → VPS checklist

- Connect ringing works at once: the notification (VAPID) keys come with `.env`.
- Your own domain later: point its `A` record to the server IP, then
  `DOMAIN=southstreet.dz bash setup.sh` and run step 5 again.
- Updates: `sudo -iu southstreet bash -lc 'cd app && ./scripts/update.sh'` (see [DEPLOY.md](../DEPLOY.md)).
- Hostinger asks for a reboot after system updates: `reboot` — the app starts by itself.
