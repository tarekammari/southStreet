#!/usr/bin/env bash
#
# TURN / STUN relay for South Street Connect calls (coturn) on the VPS.
#
#   sudo bash deploy/coturn-setup.sh southstreet.1zayd1.tech
#
# Why: two phones on mobile data (carrier NAT) or behind strict Wi-Fi often
# cannot reach each other directly; the relay carries their call then. The relay
# only ever sees the encrypted audio (DTLS-SRTP keys stay on the two phones).
#
# What it does (safe to run again; keeps the existing secret):
#  - installs coturn: STUN/TURN on 3478 (UDP + TCP), TURN over TLS on 5349
#    (gets through firewalls that only allow HTTPS-like traffic), relay ports
#    49160-49999/UDP;
#  - time-limited passwords only (use-auth-secret): the app hands each user a
#    12-hour password (lib/connect/push.ts), nobody can use the relay without one;
#  - refuses to relay into private / local networks (no access to the server's
#    own services or the hosting network through the relay), modern TLS only;
#  - uses the site's Let's Encrypt certificate and re-copies it on renewal;
#  - opens the ports in ufw, writes TURN_URLS / TURN_SECRET into the app's .env
#    and reloads the app.
set -Eeuo pipefail

DOMAIN="${1:?usage: sudo bash deploy/coturn-setup.sh <domain>}"
APP_USER="${APP_USER:-southstreet}"
APP_DIR="${APP_DIR:-/home/$APP_USER/app}"
ENV_FILE="$APP_DIR/.env"
CONF=/etc/turnserver.conf
CERTS=/etc/coturn/certs

log() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || fail "Run as root (sudo)."
[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] || fail "No certificate for $DOMAIN (run deploy/hostinger-setup.sh first)."
[ -f "$ENV_FILE" ] || fail "No $ENV_FILE"

log "1/5 Install coturn"
DEBIAN_FRONTEND=noninteractive apt-get install -y coturn >/dev/null
[ -f /etc/default/coturn ] && sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn

log "2/5 Certificate"
install -d -m 750 -o root -g turnserver "$CERTS"
cat > /etc/letsencrypt/renewal-hooks/deploy/coturn.sh <<EOF
#!/bin/sh
# Copies the renewed certificate where coturn (user turnserver) can read it.
install -m 640 -o root -g turnserver /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERTS/fullchain.pem
install -m 640 -o root -g turnserver /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERTS/privkey.pem
systemctl restart coturn 2>/dev/null || true
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/coturn.sh
install -m 640 -o root -g turnserver "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERTS/fullchain.pem"
install -m 640 -o root -g turnserver "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERTS/privkey.pem"

log "3/5 Configuration"
SECRET="$(sed -n 's/^static-auth-secret=//p' "$CONF" 2>/dev/null | head -1)"
[ -n "$SECRET" ] || SECRET="$(openssl rand -hex 32)"
PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
[ -n "$PUBLIC_IP" ] || fail "Could not find the server's public IP."
cat > "$CONF" <<EOF
# South Street Connect — written by deploy/coturn-setup.sh (run it again to change).
listening-port=3478
tls-listening-port=5349
external-ip=$PUBLIC_IP
realm=$DOMAIN
server-name=$DOMAIN
min-port=49160
max-port=49999

# Only the app's 12-hour passwords (HMAC of this secret) are accepted.
use-auth-secret
static-auth-secret=$SECRET
fingerprint

cert=$CERTS/fullchain.pem
pkey=$CERTS/privkey.pem
no-tlsv1
no-tlsv1_1
cipher-list="ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305"

# Never relay into the server itself or private networks.
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.0.2.0-192.0.2.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=198.51.100.0-198.51.100.255
denied-peer-ip=203.0.113.0-203.0.113.255
denied-peer-ip=224.0.0.0-255.255.255.255
denied-peer-ip=::1
denied-peer-ip=64:ff9b::-64:ff9b::ffff:ffff
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
# …except this relay itself: two relayed phones reach each other through it.
allowed-peer-ip=$PUBLIC_IP

# Voice needs ~40 kb/s; these limits stop anyone using the relay as a bandwidth pipe.
user-quota=8
total-quota=800
max-bps=256000
stale-nonce=600
no-rfc5780
no-stun-backward-compatibility
response-origin-only-with-rfc5780
no-cli
simple-log
log-file=/var/log/turnserver/turn.log
EOF
install -d -o turnserver -g turnserver /var/log/turnserver
chmod 640 "$CONF"
chgrp turnserver "$CONF"

log "4/5 Firewall + start"
if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow 3478/udp >/dev/null
  ufw allow 3478/tcp >/dev/null
  ufw allow 5349/tcp >/dev/null
  ufw allow 5349/udp >/dev/null
  ufw allow 49160:49999/udp >/dev/null
fi
systemctl enable coturn >/dev/null 2>&1 || true
systemctl restart coturn
sleep 1
systemctl is-active --quiet coturn || fail "coturn did not start: journalctl -u coturn -n 50"

log "5/5 Tell the app"
set_env() { if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi; }
set_env TURN_URLS "turn:$DOMAIN:3478?transport=udp,turn:$DOMAIN:3478?transport=tcp,turns:$DOMAIN:5349?transport=tcp"
set_env TURN_SECRET "$SECRET"
chown "$APP_USER": "$ENV_FILE" && chmod 600 "$ENV_FILE"
sudo -iu "$APP_USER" bash -lc "cd '$APP_DIR' && pm2 reload ecosystem.config.cjs --update-env" >/dev/null

echo
echo "Relay ready on $DOMAIN ($PUBLIC_IP): 3478 UDP/TCP, 5349 TLS, relay 49160-49999/UDP."
echo "If Hostinger's own firewall (hPanel → VPS → Firewall) is on, open the same ports there."
echo "Check: https://$DOMAIN/api/connect/status → \"relay\": true"
