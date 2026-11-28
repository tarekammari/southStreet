#!/usr/bin/env bash
# Gives every active store its own HTTPS certificate (Let's Encrypt, HTTP-01) and copies
# certificates where nginx workers can read them. Run by mobile-store-certs.timer every minute.
set -u
BASE=mobile.1zayd1.tech
DB=/var/lib/mobile-store/mobile-store.db
OUT=/etc/nginx/ms-certs        # copies readable by nginx workers (group www-data)
MARK=/var/www/ms-certs         # "this host has HTTPS" markers checked by the port-80 servers
FAILS=/var/lib/mobile-store-certs
mkdir -p "$OUT" "$MARK" "$FAILS"
chown root:www-data "$OUT"; chmod 750 "$OUT"; chmod 755 "$MARK"

changed=0
# True when the name already resolves to one of this server's addresses (no point asking Let's Encrypt before).
points_here() { local ip; ip=$(getent ahostsv4 "$1" | awk 'NR==1{print $1}'); [ -n "$ip" ] && hostname -I | tr ' ' '
' | grep -qx "$ip"; }
sync_cert() { # host
  local host=$1 live=/etc/letsencrypt/live/$1
  [ -f "$live/fullchain.pem" ] || return 0
  if [ ! -f "$OUT/$host.crt" ] || [ "$live/fullchain.pem" -nt "$OUT/$host.crt" ]; then
    install -m 640 -o root -g www-data "$live/fullchain.pem" "$OUT/$host.crt"
    install -m 640 -o root -g www-data "$live/privkey.pem" "$OUT/$host.key"
    touch "$MARK/$host"
    changed=1
  fi
}

# Main domain: issue its certificate as soon as DNS points here, then add its HTTPS server.
if [ ! -f /etc/letsencrypt/live/$BASE/fullchain.pem ] && points_here "$BASE"; then
  if [ ! -f "$FAILS/$BASE" ] || [ $(( $(date +%s) - $(stat -c %Y "$FAILS/$BASE") )) -ge 1200 ]; then
    if certbot certonly --webroot -w /var/www/letsencrypt -d "$BASE" --non-interactive --keep-until-expiring --quiet; then
      rm -f "$FAILS/$BASE"; logger -t mobile-store-certs "issued $BASE"; /usr/local/sbin/mobile-store-site
    else touch "$FAILS/$BASE"; fi
  fi
fi
# Main domain marker (turns on the HTTP → HTTPS redirect once its certificate exists).
[ -f /etc/letsencrypt/live/$BASE/fullchain.pem ] && [ ! -f "$MARK/$BASE" ] && touch "$MARK/$BASE"

[ -f "$DB" ] || exit 0
issued=0
for slug in $(sqlite3 -readonly "$DB" "SELECT slug FROM stores WHERE status = 'active' ORDER BY created_at DESC" 2>/dev/null); do
  [[ "$slug" =~ ^[a-z0-9-]{2,30}$ ]] || continue
  host="$slug.$BASE"
  if [ ! -f "/etc/letsencrypt/live/$host/fullchain.pem" ]; then
    # Do not hammer Let's Encrypt: after a failure wait an hour; at most 5 new certificates per run.
    if [ -f "$FAILS/$host" ] && [ $(( $(date +%s) - $(stat -c %Y "$FAILS/$host") )) -lt 3600 ]; then continue; fi
    [ $issued -ge 5 ] && break
    points_here "$host" || continue
    issued=$((issued + 1))
    if certbot certonly --webroot -w /var/www/letsencrypt -d "$host" --non-interactive --keep-until-expiring --quiet; then
      rm -f "$FAILS/$host"
      logger -t mobile-store-certs "issued $host"
    else
      touch "$FAILS/$host"
      logger -t mobile-store-certs "FAILED $host"
      continue
    fi
  fi
  sync_cert "$host"
done

if [ $changed = 1 ]; then nginx -t -q && systemctl reload nginx; fi
exit 0
