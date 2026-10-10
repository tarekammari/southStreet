# South Street on Oracle Cloud "Always Free"

This guide creates a free Oracle Cloud server and runs the app on it. It covers only the
Oracle-specific parts; the app setup itself is the same as in [DEPLOY.md](../DEPLOY.md),
and the steps below say when to switch to it.

**What you get for free** (from June 2026 for free-tier accounts): an ARM server
(Ampere A1) with **2 CPU + 12 GB RAM**, up to **200 GB** of disk, **10 TB/month** of
traffic and 20 GB of Object Storage (useful for off-server backups). The app needs
about 1–2 GB of RAM, so this is plenty.

> Oracle changes its free limits from time to time. Check the live page before starting:
> https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm

---

## 0. Before you start

- A **bank card** (Visa / Mastercard). Oracle uses it only to check you are a real person;
  a small temporary hold may appear and is released. Prepaid and virtual cards are often refused.
- Your **domain** (for example `southstreet.dz`) and access to its DNS settings.
  HTTPS needs a domain: Windows Hello / security keys, the microphone and secure
  login cookies do not work on a bare IP address.
- Your PC's `.env` file and database (`south_street.db`).

---

## 1. Create the Oracle account

1. Go to https://signup.cloud.oracle.com and sign up.
2. **Home region — choose carefully, it cannot be changed later.** Free ARM servers can
   only be created in the home region. Close to Algeria: **France South (Marseille)**,
   **Spain Central (Madrid)**, **Italy North (Milan)** or **France Central (Paris)**.
   If one is often "out of capacity", the others are worth trying (with a new account only).
3. Finish the card check and wait for the "account ready" email (minutes to a few hours).

### Strongly recommended: upgrade to "Pay As You Go"

In the console: **Billing & Cost Management → Upgrade and Manage Payment → Pay As You Go**.

- You still pay **nothing** while you stay inside the Always Free limits.
- Free-tier accounts can have an **idle server stopped or reclaimed** by Oracle when its
  CPU / network / memory stay very low for 7 days, which is normal for a small agency
  website. Pay As You Go accounts are not reclaimed this way.
- Pay As You Go also makes "out of capacity" errors much rarer.
- **Protect yourself from surprise costs:** **Billing → Budgets → Create Budget**, amount
  `1` (USD), alert at 100% to your email. Only create resources marked **"Always Free
  eligible"**.

---

## 2. Create the server

Console menu → **Compute → Instances → Create instance**.

| Setting | Value |
|---|---|
| Name | `south-street` |
| Image | **Change image → Canonical Ubuntu → 24.04** (the normal one, *not* "Minimal") |
| Shape | **Change shape → Ampere → VM.Standard.A1.Flex**, **2 OCPU, 12 GB** memory |
| Networking | Create a new virtual cloud network + **public subnet**, **Assign a public IPv4 address: Yes** |
| SSH keys | **Generate a key pair for me → Save private key** (keep this file safe — it is the only way in) |
| Boot volume | **Specify a custom size: 100 GB** (free up to 200 GB in total) |

Click **Create**. After 1–2 minutes the instance is **Running**; copy its **Public IP address**.

> **"Out of capacity for shape VM.Standard.A1.Flex"**: try another *Availability domain*
> (AD-1 / AD-2 / AD-3 in the Placement section), try again later (early morning works
> best), or try 1 OCPU / 6 GB first and resize later (Instance → Edit → shape).
> Upgrading to Pay As You Go usually solves it.

### Make the IP permanent (recommended)

By default the public IP can change if the instance is recreated. **Networking → IP
Management → Reserved public IPs → Reserve** (1 is free), then on the instance:
**Attached VNICs → IPv4 Addresses → Edit → Reserved public IP**.

---

## 3. Open the web ports (two places)

Oracle blocks web traffic **twice**: in the cloud network and inside Ubuntu itself.

**a) Cloud network.** Instance page → click the **Subnet** → **Security Lists → Default
Security List → Add Ingress Rules**, add two rules:

| Source CIDR | IP Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Port 22 for SSH is already open.)

**b) Inside Ubuntu** — done in step 5 below (`iptables`). Do **not** use `ufw` on Oracle
images: Oracle's own firewall rules conflict with it and you can lock yourself out.

---

## 4. Point your domain to the server

In your domain's DNS settings add:

| Type | Name | Value |
|---|---|---|
| `A` | `@` (the domain itself) | the server's public IP |
| `A` | `www` | the server's public IP |

DNS can take a few minutes to a few hours. Check from your PC: `nslookup southstreet.dz`.

---

## 5. Connect and prepare Ubuntu

### Connect from Windows

Put the downloaded key somewhere safe, e.g. `C:\Users\TAREK\.ssh\oracle.key`, then in
PowerShell make it private (SSH refuses keys that other users can read):

```powershell
icacls "$env:USERPROFILE\.ssh\oracle.key" /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i "$env:USERPROFILE\.ssh\oracle.key" ubuntu@SERVER_IP
```

The user name on Oracle Ubuntu images is **`ubuntu`**.

### Open ports 80/443 inside Ubuntu, add basics

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

sudo timedatectl set-timezone Africa/Algiers
sudo apt update && sudo apt upgrade -y
sudo apt install -y unattended-upgrades     # automatic security updates
```

### Install the software, the app user and folders

Follow **[DEPLOY.md → 1. First installation](../DEPLOY.md)**, but **skip the three `ufw`
commands** (the firewall is already handled above). Everything else works the same on
ARM: Node.js, `better-sqlite3`, `sharp` and Next.js all ship ARM (arm64) builds.

### Getting the code from GitHub

Your repository `tarekammari/southStreet` — if it is **private**, the server needs a key to read it:

```bash
sudo -iu southstreet
ssh-keygen -t ed25519 -C "oracle-server" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy the printed line to GitHub: **repo → Settings → Deploy keys → Add deploy key**
(read-only, leave "Allow write access" unticked). Then:

```bash
git clone git@github.com:tarekammari/southStreet.git app
cd app && chmod +x scripts/update.sh
```

---

## 6. Copy your secrets and data from the PC

Never put `.env` or the database in git. Copy them straight to the server.

On the server first make the target folders writable for the `ubuntu` user's upload, or
copy to `/tmp` and move them. Simplest — from **PowerShell on your PC**, in the project folder:

```powershell
npm run stop    # stop the local app so the database file is complete
$K = "$env:USERPROFILE\.ssh\oracle.key"
scp -i $K .env south_street.db ubuntu@SERVER_IP:/tmp/
scp -i $K -r public/images/uploads ubuntu@SERVER_IP:/tmp/public-uploads
scp -i $K -r images/uploads ubuntu@SERVER_IP:/tmp/images-uploads
```

Then on the server:

```bash
sudo mv /tmp/south_street.db /var/lib/south-street/
sudo mv /tmp/.env /home/southstreet/app/.env
sudo mkdir -p /home/southstreet/app/public/images /home/southstreet/app/images
sudo mv /tmp/public-uploads /home/southstreet/app/public/images/uploads
sudo mv /tmp/images-uploads /home/southstreet/app/images/uploads
sudo chown -R southstreet: /var/lib/south-street /home/southstreet/app
sudo chmod 600 /home/southstreet/app/.env
```

Now edit `/home/southstreet/app/.env` (`sudo -iu southstreet nano app/.env`) and change
the values listed in **DEPLOY.md → Environment** — mainly `DB_PATH`, `BACKUP_DIR`,
`APP_ORIGIN`, `WEBAUTHN_ORIGINS`, `WEBAUTHN_RP_ID` and `NODE_ENV=production`.
**Keep `JWT_SECRET`, `DB_ENCRYPTION_SECRET`, `DB_LOOKUP_SECRET` exactly as on the PC**,
otherwise the database cannot be read.

---

## 7. Start the app, Nginx and HTTPS

Continue with DEPLOY.md, which works unchanged here:

1. **First start** — `npm ci`, build, `pm2 start`, `pm2 save`, `pm2 startup`.
2. **Nginx + HTTPS** — copy `deploy/nginx.conf`, replace `example.com` with your domain,
   run `certbot`. (DNS from step 4 must already point to the server.)
3. **Super Admin on the new domain** — `npm run admin:recover -- --yes`, open the link on
   `https://your-domain`, register Windows Hello again. Then regenerate recovery codes.

Check: open `https://your-domain` and `https://your-domain/api/health`.

---

## 8. Off-server backups with Oracle Object Storage (free 20 GB)

The nightly backup (03:00) stays on the same server. If the server is ever lost, so are
those copies, so send them to Object Storage too:

1. Console → **Storage → Buckets → Create bucket** `south-street-backups` (Standard tier).
2. **Profile (top right) → My profile → Customer secret keys → Generate** — copy the
   *Access key* and *Secret* (shown once).
3. On the server:

```bash
sudo apt install -y rclone
sudo -iu southstreet rclone config
#  n) new remote → name: oracle → storage: s3 → provider: "Oracle Object Storage"
#  access_key_id / secret_access_key: from step 2
#  endpoint: https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
#    (namespace: Profile → Tenancy → Object storage namespace; region e.g. eu-marseille-1)
sudo -iu southstreet crontab -e
# add this line — copies new backups every night at 03:30:
30 3 * * * rclone copy /var/lib/south-street/backups oracle:south-street-backups --max-age 48h
```

Backups are already encrypted at the value level by the app, but anyone with the files
**and** your `.env` secrets could read them — keep the secrets in a password manager.

---

## 9. Updates

Exactly as in **DEPLOY.md → 2. Updating**: on the PC `npm run release -- patch --push`,
then on the server:

```bash
ssh -i "$env:USERPROFILE\.ssh\oracle.key" ubuntu@SERVER_IP
sudo -iu southstreet
cd app && ./scripts/update.sh
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Site does not open, `curl http://127.0.0.1:3000/api/health` works on the server | Ports: check the Security List rules (step 3a) **and** the `iptables` lines (step 5) |
| `ssh: Permission denied (publickey)` | Use user `ubuntu`, the right key file, and the `icacls` command from step 5 |
| `UNPROTECTED PRIVATE KEY FILE` on Windows | Run the `icacls` command again |
| certbot fails | DNS not pointing to the server yet (`nslookup your-domain`), or port 80 closed |
| "Out of capacity" when creating | See step 2 — other AD, later time, or Pay As You Go |
| Email "your instance is idle and will be reclaimed" | Upgrade to Pay As You Go (step 1) |
| Windows Hello does not work on the domain | Keys belong to one address: run `npm run admin:recover -- --yes` and register again on the domain |
