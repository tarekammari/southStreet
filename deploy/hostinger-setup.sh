#!/usr/bin/env bash
# South Street: one-command setup on a Hostinger VPS (Ubuntu 24.04 / 26.04), run as root.
# Guide: deploy/HOSTINGER.md
#
#   curl -fsSL https://raw.githubusercontent.com/tarekammari/southStreet/main/deploy/hostinger-setup.sh -o setup.sh
#   bash setup.sh
#
# Safe to run again: steps already done are skipped, the server database is never replaced.
# With your own domain later:   DOMAIN=southstreet.dz bash setup.sh
set -euo pipefail

REPO="https://github.com/tarekammari/southStreet.git"
APP_USER="southstreet"
APP_DIR="/home/$APP_USER/app"
DATA="/var/lib/south-street"
UP="/root/upload"
HC="SouthStreet-HealthCheck/1.0"   # the app blocks the plain curl user agent
DOMAIN="${DOMAIN:-$(hostname -f 2>/dev/null || hostname)}"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m!! %s\033[0m\n' "$*"; exit 1; }
as_app() { sudo -iu "$APP_USER" bash -lc "cd $APP_DIR && $*"; }

[ "$(id -u)" = 0 ] || fail "Run as root (the Hostinger web terminal logs in as root)."
case "$DOMAIN" in *.*) ;; *) fail "No domain found. Run again with: DOMAIN=your-domain bash setup.sh" ;; esac
IP="$(curl -fsS4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

log "1/8 System packages (a few minutes)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get -y -o Dpkg::Options::=--force-confold upgrade
apt-get install -y git nginx ffmpeg build-essential python3 curl ca-certificates ufw certbot python3-certbot-nginx unattended-upgrades
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2
echo "node $(node -v), pm2 $(pm2 -v)"

log "2/8 Firewall and swap"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "3/8 App user and code"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$DATA/backups" && chown -R "$APP_USER": "$DATA"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" config core.fileMode false
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi
sudo -u "$APP_USER" git -C "$APP_DIR" config core.fileMode false   # file permissions are not code changes
chmod +x "$APP_DIR/scripts/update.sh"

log "4/8 Your data (.env, database, uploaded images)"
mkdir -p "$UP"
if [ ! -f "$APP_DIR/.env" ] && { [ ! -f "$UP/.env" ] || [ ! -f "$UP/south_street.db" ]; }; then
  cat <<EOF

  The server is ready for your data. On your PC, open PowerShell and run:

      cd D:\\data\\south_street\\deploy-upload
      scp .env south_street.db uploads.tgz root@$IP:/root/upload/

  (it asks for the root password of the VPS), then run again:   bash setup.sh
EOF
  exit 0
fi
[ -f "$APP_DIR/.env" ] || install -o "$APP_USER" -g "$APP_USER" -m 600 "$UP/.env" "$APP_DIR/.env"
if [ ! -f "$DATA/south_street.db" ]; then
  install -o "$APP_USER" -g "$APP_USER" -m 600 "$UP/south_street.db" "$DATA/south_street.db"
  echo "database copied"
else
  echo "server database kept (not replaced)"
fi
if [ -f "$UP/uploads.tgz" ] && [ ! -f "$DATA/.uploads-imported" ]; then
  tar -xzf "$UP/uploads.tgz" -C "$APP_DIR" --no-same-owner
  chown -R "$APP_USER": "$APP_DIR/images" "$APP_DIR/public/images"
  touch "$DATA/.uploads-imported"
  echo "images imported"
fi

setenv() {
  if grep -q "^$1=" "$APP_DIR/.env"; then sed -i "s|^$1=.*|$1=$2|" "$APP_DIR/.env"; else echo "$1=$2" >> "$APP_DIR/.env"; fi
}
setenv NODE_ENV production
setenv PORT 3000
setenv DB_PATH "$DATA/south_street.db"
setenv BACKUP_DIR "$DATA/backups"
setenv APP_ORIGIN "https://$DOMAIN"
setenv WEBAUTHN_RP_ID "$DOMAIN"
setenv WEBAUTHN_ORIGINS "https://$DOMAIN"
setenv ALLOWED_ORIGINS "https://$DOMAIN"
chown "$APP_USER": "$APP_DIR/.env" && chmod 600 "$APP_DIR/.env"

log "5/8 Build the app (3-6 minutes)"
if [ ! -f "$APP_DIR/.next-active" ]; then
  as_app "npm ci && NEXT_DIST_DIR=.next-a npm run build && echo .next-a > .next-active && git checkout -q -- next-env.d.ts tsconfig.json"
else
  echo "already built (later versions: ./scripts/update.sh)"
fi

log "6/8 Start with PM2 (restarts by itself, also after a reboot)"
if as_app "pm2 describe south-street" >/dev/null 2>&1; then
  as_app "pm2 reload ecosystem.config.cjs --update-env"
else
  as_app "pm2 start ecosystem.config.cjs"
fi
as_app "pm2 save"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null
for i in $(seq 1 60); do
  curl -fsS -A "$HC" http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS -A "$HC" http://127.0.0.1:3000/api/health >/dev/null || fail "The app does not answer. Look at: sudo -iu $APP_USER pm2 logs south-street"
echo "app is running"

log "7/8 Nginx and HTTPS for $DOMAIN"
SITE=/etc/nginx/sites-available/south-street
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # Plain HTTP first, so Let's Encrypt can check the domain.
  cat > "$SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location / { proxy_pass http://127.0.0.1:3000; }
}
EOF
  ln -sf "$SITE" /etc/nginx/sites-enabled/south-street
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  if [ -n "${EMAIL:-}" ]; then MAIL=(-m "$EMAIL"); else MAIL=(--register-unsafely-without-email); fi
  certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos "${MAIL[@]}"
fi
sed -e 's/ www\.example\.com//g' \
    -e 's/example\.com/'"$DOMAIN"'/g' \
    -e 's|# ssl_certificate|ssl_certificate|' \
    "$APP_DIR/deploy/nginx.conf" > "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/south-street
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
curl -fsS -A "$HC" -o /dev/null "https://$DOMAIN/api/health" && echo "https://$DOMAIN answers"

log "8/8 Done"
cat <<EOF

  Site:     https://$DOMAIN
  Connect:  https://$DOMAIN/connect

  Super Admin: security keys belong to a web address, so register them again here.
  Run this, open the link it prints, set a password and add your keys:

      sudo -iu $APP_USER bash -lc 'cd app && npm run admin:recover -- --yes'

  Update to a new version later:
      sudo -iu $APP_USER bash -lc 'cd app && ./scripts/update.sh'
EOF
