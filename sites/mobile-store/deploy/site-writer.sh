#!/usr/bin/env bash
# Writes /etc/nginx/sites-available/mobile-store (adds the main-domain HTTPS block once its certificate exists),
# tests it and reloads nginx. A rejected config is disabled instead of left in place.
set -eu
DOMAIN=mobile.1zayd1.tech
SRC=/usr/local/share/mobile-store
if [ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
  python3 -c 'import sys; s=open(sys.argv[1]).read(); m=open(sys.argv[2]).read(); sys.stdout.write(s.replace("#__MAIN_HTTPS__", m))' \
    "$SRC/nginx-site.conf" "$SRC/nginx-main-https.conf" > /etc/nginx/sites-available/mobile-store
else
  cp "$SRC/nginx-site.conf" /etc/nginx/sites-available/mobile-store
fi
ln -sfn /etc/nginx/sites-available/mobile-store /etc/nginx/sites-enabled/mobile-store
if ! nginx -t -q 2>/dev/null; then rm -f /etc/nginx/sites-enabled/mobile-store; echo "nginx config rejected, site disabled" >&2; nginx -t; exit 1; fi
systemctl reload nginx
