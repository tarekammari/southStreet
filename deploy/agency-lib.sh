#!/usr/bin/env bash
# Shared by deploy/agency-*.sh and deploy/agencies-update.sh (see deploy/AGENCIES.md).
# Sourced, never run directly.
# shellcheck disable=SC2034  # the A_* and path variables are used by the scripts that source this
#
# One agency = one Linux user + its own checkout of the app + its own data folder:
#
#   user      ss-<slug>                         (the first install: southstreet)
#   code      /home/ss-<slug>/app               (own .env, own uploads, own builds)
#   data      /var/lib/south-street/<slug>/     (database + backups)
#   process   PM2 south-street-<slug>           (each user has its own PM2)
#   site      /etc/nginx/sites-available/south-street-<slug>
#   registry  /etc/south-street/agencies/<slug>.env   (root only)
#
# The paths can be moved with the variables below, only for tests.

REPO="${REPO:-https://github.com/tarekammari/southStreet.git}"
BASE_DOMAIN="${BASE_DOMAIN:-1zayd1.tech}"
SS_ETC="${SS_ETC:-/etc/south-street}"
SS_DATA="${SS_DATA:-/var/lib/south-street}"
SS_HOME="${SS_HOME:-/home}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
LE_LIVE="${LE_LIVE:-/etc/letsencrypt/live}"
REG="$SS_ETC/agencies"
BACKUP_KEY="$SS_ETC/backup-public.pem"   # the owner's public backup key, shared by all agencies
DEFAULTS_ENV="$SS_ETC/agency-defaults.env"   # optional vendor-wide keys for new agencies
HC="SouthStreet-HealthCheck/1.0"         # the app blocks the plain curl user agent
FIRST_PORT=3101
LEGACY_SLUG=southstreet

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
fail() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

need_root() { [ "$(id -u)" = 0 ] || fail "Run as root."; }

need_tools() {
  local t
  for t in git node npm pm2 nginx certbot curl sudo; do
    command -v "$t" >/dev/null || fail "$t is missing. Set up the server first: bash deploy/hostinger-setup.sh"
  done
}

valid_slug() {
  [[ "$1" =~ ^[a-z][a-z0-9-]{1,27}[a-z0-9]$ ]] || return 1
  case "$1" in
    www|api|app|mail|smtp|imap|pop|ftp|ns1|ns2|admin|vendor|panel|static|cdn|status|test|staging) return 1 ;;
  esac
}

valid_domain() {
  [[ "$1" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]]
}

# ── Registry ────────────────────────────────────────────────────────────────
# A_SLUG A_USER A_DIR A_DATA A_PORT A_PM2 A_DOMAIN A_REDIRECTS A_SITE A_NGINX
# A_REDIRECTS: space-separated hosts that forward to A_DOMAIN.
# A_NGINX=0: the site file is not ours (the first install, written by hostinger-setup.sh).

reg_file() { printf '%s/%s.env' "$REG" "$1"; }

load_agency() {
  local f
  f="$(reg_file "$1")"
  [ -f "$f" ] || return 1
  A_SLUG="" A_USER="" A_DIR="" A_DATA="" A_PORT="" A_PM2="" A_DOMAIN="" A_REDIRECTS="" A_SITE="" A_NGINX=1
  # shellcheck disable=SC1090
  . "$f"
}

save_agency() {
  mkdir -p "$REG"
  chmod 755 "$SS_ETC"   # the apps read the backup key here
  chmod 700 "$REG"
  {
    echo "# South Street agency (written by deploy/agency-*.sh)"
    local k
    for k in A_SLUG A_USER A_DIR A_DATA A_PORT A_PM2 A_DOMAIN A_REDIRECTS A_SITE A_NGINX; do
      printf '%s=%q\n' "$k" "${!k}"
    done
  } > "$(reg_file "$A_SLUG").tmp"
  chmod 600 "$(reg_file "$A_SLUG").tmp"
  mv "$(reg_file "$A_SLUG").tmp" "$(reg_file "$A_SLUG")"
}

all_slugs() { # the first install first, then the others by name
  local f s
  [ -f "$(reg_file "$LEGACY_SLUG")" ] && echo "$LEGACY_SLUG"
  for f in "$REG"/*.env; do
    [ -e "$f" ] || continue
    s="$(basename "$f" .env)"
    [ "$s" = "$LEGACY_SLUG" ] || echo "$s"
  done
}

# The install made by hostinger-setup.sh becomes agency "southstreet" where it is:
# nothing is moved, its Nginx site stays hostinger-setup.sh's.
register_legacy() {
  local dir="$SS_HOME/southstreet/app" origin port
  [ -f "$(reg_file "$LEGACY_SLUG")" ] && return 0
  [ -f "$dir/.env" ] || return 0
  origin="$(env_get "$dir/.env" APP_ORIGIN)"
  port="$(env_get "$dir/.env" PORT)"
  A_SLUG=$LEGACY_SLUG A_USER=southstreet A_DIR="$dir" A_DATA="$SS_DATA"
  A_PORT="${port:-3000}" A_PM2=south-street A_DOMAIN="${origin#https://}" A_REDIRECTS="" A_SITE=south-street A_NGINX=0
  save_agency
  info "existing install registered as agency '$LEGACY_SLUG' (port $A_PORT, nothing moved)"
}

# ── .env files ──────────────────────────────────────────────────────────────

env_get() { # file key
  [ -f "$1" ] || return 0
  sed -n "s/^$2=//p" "$1" | tail -n 1 | tr -d '\r' | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

env_set() { # file key value — replaces the line in place (keeps owner and mode)
  local tmp
  tmp="$(mktemp)"
  awk -v k="$2" -v v="$3" '
    index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$1" > "$tmp"
  cat "$tmp" > "$1"
  rm -f "$tmp"
}

rand_hex() { # bytes
  if command -v openssl >/dev/null; then openssl rand -hex "$1"
  else node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; fi
}

# Points the app at its addresses: the main domain, sign-in keys, CORS.
env_set_domain() { # file domain
  env_set "$1" APP_ORIGIN "https://$2"
  env_set "$1" WEBAUTHN_RP_ID "$2"
  env_set "$1" WEBAUTHN_ORIGINS "https://$2"
  env_set "$1" ALLOWED_ORIGINS "https://$2"
}

# ── Running as the agency's user ────────────────────────────────────────────

as_agency() { # command... (in the agency's app folder, login shell for PM2/npm)
  sudo -iu "$A_USER" bash -lc "cd $(printf %q "$A_DIR") && $*"
}

local_health() { # port → health JSON, or nothing
  curl -fsS -A "$HC" --max-time 4 "http://127.0.0.1:$1/api/health" 2>/dev/null | grep '"ok":true' || true
}

wait_local_health() { # port
  local _
  for _ in $(seq 1 60); do
    [ -n "$(local_health "$1")" ] && return 0
    sleep 2
  done
  return 1
}

# ── Ports ───────────────────────────────────────────────────────────────────

used_ports() {
  local s
  for s in $(all_slugs); do (load_agency "$s" && echo "$A_PORT"); done
  ss -ltnH 2>/dev/null | awk '{ n = split($4, a, ":"); print a[n] }'
}

free_port() {
  local p=$FIRST_PORT used
  used=" $(used_ports | sort -un | tr '\n' ' ') "
  while [[ "$used" == *" $p "* ]]; do p=$((p + 1)); done
  [ "$p" -lt 3999 ] || fail "No free port between $FIRST_PORT and 3999."
  echo "$p"
}

# ── DNS ─────────────────────────────────────────────────────────────────────

server_ips() {
  if [ -n "${SERVER_IPS:-}" ]; then echo "$SERVER_IPS" | tr ' ' '\n'; return; fi
  hostname -I 2>/dev/null | tr ' ' '\n'
  curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null && echo
  curl -fsS6 --max-time 5 https://api64.ipify.org 2>/dev/null && echo
}

# The domain must point to this server (A, and AAAA if it has one: Let's Encrypt
# tries IPv6 first), or the certificate cannot be issued.
check_dns() { # domain → 0 if it points here
  local d=$1 ours v4 v6 ip ok=0
  [ "${SKIP_DNS_CHECK:-}" = 1 ] && return 0
  ours=" $(server_ips | sed '/^$/d' | sort -u | tr '\n' ' ') "
  v4="$(getent ahostsv4 "$d" 2>/dev/null | awk '{print $1}' | sort -u)"
  v6="$(getent ahostsv6 "$d" 2>/dev/null | awk '{print $1}' | grep -v '^::ffff:' | sort -u || true)"
  if [ -z "$v4" ]; then warn "$d has no A record."; return 1; fi
  for ip in $v4; do
    [[ "$ours" == *" $ip "* ]] || { warn "$d points to $ip, not to this server ($ours)."; ok=1; }
  done
  for ip in $v6; do
    [[ "$ours" == *" $ip "* ]] || { warn "$d has an AAAA record ($ip) that is not this server: remove it."; ok=1; }
  done
  return $ok
}

# ── Certificates and Nginx ──────────────────────────────────────────────────

has_cert() { [ -f "$LE_LIVE/$1/fullchain.pem" ]; }

# One certificate per host (renewed by certbot's own timer).
ensure_certs() { # host...
  local h missing=() tmp="$NGINX_DIR/sites-enabled/south-street-acme-tmp" mail
  for h in "$@"; do has_cert "$h" || missing+=("$h"); done
  [ ${#missing[@]} -eq 0 ] && return 0
  # Plain HTTP for the new names, so Let's Encrypt can check them.
  printf 'server {\n    listen 80;\n    listen [::]:80;\n    server_name %s;\n    location / { return 404; }\n}\n' "${missing[*]}" > "$tmp"
  if ! nginx -t >/dev/null 2>&1; then rm -f "$tmp"; fail "nginx -t failed before asking for certificates."; fi
  systemctl reload nginx
  if [ -n "${EMAIL:-}" ]; then mail=(-m "$EMAIL"); else mail=(--register-unsafely-without-email); fi
  for h in "${missing[@]}"; do
    info "certificate for $h"
    certbot certonly --nginx -d "$h" --non-interactive --agree-tos "${mail[@]}" \
      || { rm -f "$tmp"; systemctl reload nginx; fail "No certificate for $h (does it point to this server?)."; }
  done
  rm -f "$tmp"
}

redirect_block() { # from-host to-host
  cat <<EOF

server {
    listen 80;
    listen [::]:80;
    server_name $1;
    return 301 https://$2\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $1;
    ssl_certificate     $LE_LIVE/$1/fullchain.pem;
    ssl_certificate_key $LE_LIVE/$1/privkey.pem;
    server_tokens off;
    return 301 https://$2\$request_uri;
}
EOF
}

# The agency's site, from its own copy of deploy/nginx.conf: main domain → its
# port, every other name forwards to the main domain.
write_site() {
  local avail="$NGINX_DIR/sites-available/$A_SITE" new h
  [ "$A_NGINX" = 1 ] || fail "The Nginx site of '$A_SLUG' is managed by deploy/hostinger-setup.sh."
  new="$(mktemp)"
  sed -e 's/ www\.example\.com//g' \
      -e "s/example\\.com/$A_DOMAIN/g" \
      -e 's|# ssl_certificate|ssl_certificate|' \
      -e "s|/etc/letsencrypt/live/|$LE_LIVE/|" \
      -e "s|127\\.0\\.0\\.1:3000|127.0.0.1:$A_PORT|g" \
      -e "1s|.*|# $A_SITE: agency $A_SLUG (written by deploy/agency-*.sh, do not edit)|" -e 2d \
      "$A_DIR/deploy/nginx.conf" > "$new"
  for h in $A_REDIRECTS; do redirect_block "$h" "$A_DOMAIN" >> "$new"; done
  [ -f "$avail" ] && cp "$avail" "$avail.bak"
  cat "$new" > "$avail"
  rm -f "$new"
  ln -sf "$avail" "$NGINX_DIR/sites-enabled/$A_SITE"
  if ! nginx -t >/dev/null 2>&1; then
    nginx -t || true
    if [ -f "$avail.bak" ]; then mv "$avail.bak" "$avail"; else rm -f "$avail" "$NGINX_DIR/sites-enabled/$A_SITE"; fi
    fail "nginx -t failed: the previous site was put back."
  fi
  rm -f "$avail.bak"
  systemctl reload nginx
}

https_health() { # host → health JSON, or nothing
  curl -fsS -A "$HC" --max-time 8 "https://$1/api/health" 2>/dev/null | grep '"ok":true' || true
}

security_key_warning() { # domain
  printf '\n\033[1;41;97m%s\033[0m\n' "  SECURITY KEYS MUST BE REGISTERED AGAIN  "
  cat <<EOF
  Security keys belong to one web address. Keys the admins registered on the old
  address do NOT work on https://$1. The Super Admin gets a new activation link:

      sudo -iu $A_USER bash -lc 'cd app && npm run admin:recover -- --yes'

  then opens it on https://$1, sets a password and adds two keys. For each Admin,
  the Super Admin then resets the security keys from the staff accounts page and
  sends the new enrollment link.
  Google sign-in: add https://$1 to the OAuth client's Authorized JavaScript origins.
EOF
}
