#!/usr/bin/env bash
# Runs ON THE VPS as root (deploy.sh calls it). Idempotent: first install and every update.
#   bash install.sh <bundle.tgz>
set -euo pipefail
BUNDLE=${1:?bundle}
HERE=$(cd "$(dirname "$0")" && pwd)
DOMAIN=mobile.1zayd1.tech
APP_USER=mobilestore
APP=/home/$APP_USER/app
ENVF=/home/$APP_USER/.env

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin "$APP_USER"
chmod 750 /home/$APP_USER
command -v sqlite3 >/dev/null || apt-get install -y -qq sqlite3

# ---- code: new release folder, then atomic switch ----
REL=/home/$APP_USER/releases/$(date +%Y%m%d-%H%M%S)
mkdir -p "$REL"
tar -xzf "$BUNDLE" -C "$REL"
chown -R root:$APP_USER "$REL"; chmod -R g+rX,o-rwx "$REL"
ln -sfn "$REL" "$APP.new" && mv -Tf "$APP.new" "$APP"
ls -1dt /home/$APP_USER/releases/* | tail -n +6 | xargs -r rm -rf   # keep 5 releases

# ---- settings (.env is created once and never overwritten) ----
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<EOF
NODE_ENV=production
PORT=3300
HOST=127.0.0.1
APP_NAME=Mobilo
PUBLIC_URL=https://$DOMAIN
DATA_DIR=/var/lib/mobile-store
APP_SECRET=$(openssl rand -hex 32)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SUPER_ADMIN_EMAILS=${SUPER_ADMIN_EMAILS:-}
TRIAL_DAYS=30
MAX_STORES_PER_USER=3
STORE_URL_MODE=subdomain
EOF
fi
chown root:$APP_USER "$ENVF"; chmod 640 "$ENVF"

# ---- service ----
install -m 644 "$HERE/mobile-store.service" /etc/systemd/system/mobile-store.service
install -m 755 "$HERE/cert-worker.sh" /usr/local/sbin/mobile-store-certs
cat > /etc/systemd/system/mobile-store-certs.service <<'EOF'
[Unit]
Description=HTTPS certificates for mobile store subdomains
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/mobile-store-certs
EOF
cat > /etc/systemd/system/mobile-store-certs.timer <<'EOF'
[Unit]
Description=Check new stores for HTTPS certificates every minute
[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=10s
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now mobile-store-certs.timer >/dev/null
systemctl enable mobile-store >/dev/null
systemctl restart mobile-store

# ---- nginx ----
mkdir -p /var/cache/nginx/mobile-store /var/www/letsencrypt /var/www/ms-certs /etc/nginx/ms-certs
install -m 644 "$HERE/nginx-http.conf" /etc/nginx/conf.d/mobile-store-http.conf
install -m 644 "$HERE/nginx-common.conf" /etc/nginx/snippets/mobile-store-common.conf
install -m 644 "$HERE/nginx-proxy.conf" /etc/nginx/snippets/mobile-store-proxy.conf
install -d /usr/local/share/mobile-store
install -m 644 "$HERE/nginx-site.conf" "$HERE/nginx-main-https.conf" /usr/local/share/mobile-store/
install -m 755 "$HERE/site-writer.sh" /usr/local/sbin/mobile-store-site
/usr/local/sbin/mobile-store-site

# Certificates: main domain + every store (needs DNS "mobile" and "*.mobile" → this server).
/usr/local/sbin/mobile-store-certs || true
[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ] && echo "HTTPS ready for $DOMAIN"   || echo "No certificate for $DOMAIN yet: it is issued automatically within a minute once the DNS records point here."

# ---- health ----
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -A 'MobileStore-HealthCheck/1.0' http://127.0.0.1:3300/healthz >/dev/null 2>&1; then echo "mobile-store is up ($REL)"; exit 0; fi
  sleep 1
done
echo "mobile-store did not answer on :3300"; journalctl -u mobile-store -n 30 --no-pager; exit 1
