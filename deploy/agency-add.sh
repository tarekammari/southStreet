#!/usr/bin/env bash
# Adds one agency: its own South Street on <slug>.1zayd1.tech (and its own domain).
# Run as root on the VPS, after deploy/hostinger-setup.sh. Guide: deploy/AGENCIES.md
#
#   bash deploy/agency-add.sh <slug> [--domain www.example.dz] [--ref main] [--email you@mail] [--profile deploy/agencies/<slug>]
#
# Safe to run again: secrets, database and uploads are kept, steps already done
# are skipped. Choose the final domain BEFORE the agency's Super Admin is created
# (security keys belong to one address); later moves: deploy/agency-domain.sh.
set -Eeuo pipefail
# shellcheck source=deploy/agency-lib.sh
. "$(dirname "$0")/agency-lib.sh"

usage() { echo "Usage: bash deploy/agency-add.sh <slug> [--domain www.example.dz] [--ref main] [--email you@mail] [--profile deploy/agencies/<slug>]"; exit 1; }

SLUG="${1:-}"; [ -n "$SLUG" ] || usage; shift
DOMAIN="" REF="main" PROFILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
DOMAIN="${DOMAIN,,}"
SUB="$SLUG.$BASE_DOMAIN"

need_root
need_tools
valid_slug "$SLUG" || fail "Slug '$SLUG': 3-30 characters, a-z 0-9 and -, starting with a letter (not www, api, admin...)."
[ -z "$DOMAIN" ] || valid_domain "$DOMAIN" || fail "Not a domain name: $DOMAIN"
if [ -n "$PROFILE" ]; then
  [ -d "$PROFILE" ] || fail "No profile folder: $PROFILE"
  PROFILE="$(cd "$PROFILE" && pwd)"
  check_profile "$PROFILE" "$SLUG"
fi
[ "$DOMAIN" != "$SUB" ] || DOMAIN=""

register_legacy
if [ "$SLUG" = "$LEGACY_SLUG" ]; then
  load_agency "$SLUG" || fail "No install in $SS_HOME/southstreet/app: set it up with deploy/hostinger-setup.sh."
  info "'$SLUG' is the first install, managed by deploy/hostinger-setup.sh: nothing to do."
  exit 0
fi

# ── Who and where ───────────────────────────────────────────────────────────
log "1/9 Agency $SLUG"
if load_agency "$SLUG"; then
  info "already registered (port $A_PORT, $A_DOMAIN): checking every step"
  if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "$A_DOMAIN" ]; then
    fail "$SLUG already answers on $A_DOMAIN. To move it: bash deploy/agency-domain.sh $SLUG $DOMAIN"
  fi
else
  A_SLUG=$SLUG A_USER="ss-$SLUG" A_PM2="south-street-$SLUG" A_SITE="south-street-$SLUG" A_NGINX=1
  A_DIR="$SS_HOME/$A_USER/app" A_DATA="$SS_DATA/$SLUG"
  A_PORT="$(free_port)"
  if [ -n "$DOMAIN" ]; then A_DOMAIN=$DOMAIN A_REDIRECTS=$SUB; else A_DOMAIN=$SUB A_REDIRECTS=""; fi
fi
info "user $A_USER, port $A_PORT, https://$A_DOMAIN${A_REDIRECTS:+ (also $A_REDIRECTS)}"

# DNS first: without it there is no certificate, so stop before building anything.
DNS_OK=1
for h in $A_DOMAIN $A_REDIRECTS; do
  has_cert "$h" && continue
  check_dns "$h" || DNS_OK=0
done
[ $DNS_OK = 1 ] || fail "Fix the DNS records above (deploy/AGENCIES.md), wait a few minutes, run again."

# The owner's public backup key: backups are encrypted to it, the server cannot read them.
if [ ! -s "$BACKUP_KEY" ]; then
  legacy_key="$(env_get "$SS_HOME/southstreet/app/.env" BACKUP_PUBLIC_KEY_FILE)"
  if [ -n "$legacy_key" ] && [ -s "$legacy_key" ]; then
    mkdir -p "$SS_ETC"
    cp "$legacy_key" "$BACKUP_KEY"
    info "backup key copied from the first install ($legacy_key)"
  else
    fail "No backup key in $BACKUP_KEY. Copy your backup-public-key.pem there (npm run backup:key -- generate, on your PC)."
  fi
fi
chmod 644 "$BACKUP_KEY"

# Registered now, so a second run (or another agency) never takes the same port.
save_agency

log "2/9 Linux user and folders"
id "$A_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$A_USER"
chmod 750 "$SS_HOME/$A_USER"          # agencies cannot read each other's code, .env or uploads
mkdir -p "$SS_DATA"
chmod 755 "$SS_DATA"
mkdir -p "$A_DATA/backups"
chown -R "$A_USER": "$A_DATA"
chmod 700 "$A_DATA" "$A_DATA/backups"

log "3/9 Code"
if [ -d "$A_DIR/.git" ]; then
  info "already downloaded (later versions: deploy/agencies-update.sh)"
else
  sudo -u "$A_USER" git clone --quiet "$REPO" "$A_DIR"
  sudo -u "$A_USER" git -C "$A_DIR" checkout --quiet "$REF"
  if ! grep -q PM2_APP "$A_DIR/ecosystem.config.cjs"; then
    rm -rf "$A_DIR"
    fail "Version $REF is too old for several agencies (no PM2_APP in ecosystem.config.cjs): use a newer --ref."
  fi
  info "$REF ($(sudo -u "$A_USER" git -C "$A_DIR" rev-parse --short HEAD))"
fi
grep -q PM2_APP "$A_DIR/ecosystem.config.cjs" \
  || fail "The code in $A_DIR is too old for several agencies: sudo -u $A_USER git -C $A_DIR checkout <newer ref>, then run again."
sudo -u "$A_USER" git -C "$A_DIR" config core.fileMode false
mkdir -p "$A_DIR/logs" && chown "$A_USER": "$A_DIR/logs"

log "4/9 Dependencies"
if [ -d "$A_DIR/node_modules/next" ]; then
  info "already installed"
else
  as_agency "npm ci --no-audit --no-fund"
fi

log "5/9 Settings and fresh secrets (.env)"
ENV="$A_DIR/.env"
if [ ! -f "$ENV" ]; then
  [ -f "$A_DATA/south_street.db" ] && fail "$A_DATA/south_street.db exists but $ENV is gone: without its secrets the database cannot be read. Put the .env back first."
  vapid="$(as_agency "node -e \"const k=require('web-push').generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)\"" 2>/dev/null || true)"
  [ -n "$vapid" ] || warn "Could not create notification (VAPID) keys: Connect ringing stays off until they are set."
  install -o "$A_USER" -g "$A_USER" -m 600 /dev/null "$ENV"
  cat > "$ENV" <<EOF
# South Street, agency $SLUG — created by deploy/agency-add.sh on $(date -u +%Y-%m-%d).
# Keep a copy of the secrets in a password manager: without them the database cannot be read.
NODE_ENV=production
JWT_SECRET=$(rand_hex 64)
JWT_EXPIRES_IN=24h
DB_ENCRYPTION_SECRET=$(rand_hex 32)
DB_LOOKUP_SECRET=$(rand_hex 32)
SECURITY_INGEST_TOKEN=$(rand_hex 32)
VAPID_PUBLIC_KEY=${vapid%% *}
VAPID_PRIVATE_KEY=${vapid##* }
VAPID_SUBJECT=mailto:${EMAIL:-contact@$A_DOMAIN}
SEED_DEMO_DATA=0
REQUIRE_ADMIN_APPROVAL_FOR_NEW_USERS=false
ONLINE_CARD_PAY_ENABLED=false
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=900000
POLLINATIONS_ENABLED=true
SAKHR_AI_PROVIDER=auto
EOF
  # Vendor-wide keys (Google sign-in client, AI keys, TURN...), the same for every agency.
  if [ -f "$DEFAULTS_ENV" ]; then
    grep -E '^[A-Z_][A-Z0-9_]*=' "$DEFAULTS_ENV" | while IFS= read -r line; do
      env_set "$ENV" "${line%%=*}" "${line#*=}"
    done
    info "vendor keys added from $DEFAULTS_ENV"
  fi
  info "new secrets written"
else
  info "kept (secrets unchanged)"
fi
# Managed lines: always set, so a second run repairs them.
env_set "$ENV" PORT "$A_PORT"
env_set "$ENV" PM2_APP "$A_PM2"
env_set "$ENV" DB_PATH "$A_DATA/south_street.db"
env_set "$ENV" BACKUP_DIR "$A_DATA/backups"
env_set "$ENV" BACKUP_PUBLIC_KEY_FILE "$BACKUP_KEY"
env_set_domain "$ENV" "$A_DOMAIN"
# Nightly jobs 5 minutes apart per agency, not all at 03:00 / 02:00.
minute=$(( (A_PORT - 3100) * 5 % 60 ))
env_set "$ENV" BACKUP_CRON "$minute 3 * * *"
env_set "$ENV" OFFICIAL_UPDATES_CRON "$minute 2 * * *"
chown "$A_USER": "$ENV" && chmod 600 "$ENV"

log "6/9 Build (3-6 minutes)"
if [ -f "$A_DIR/.next-active" ]; then
  info "already built (later versions: deploy/agencies-update.sh)"
else
  as_agency "NEXT_DIST_DIR=.next-a npm run build && echo .next-a > .next-active && git checkout -q -- next-env.d.ts tsconfig.json"
fi

log "7/9 Start with PM2 ($A_PM2)"
if as_agency "pm2 describe $A_PM2" >/dev/null 2>&1; then
  as_agency "pm2 reload ecosystem.config.cjs --update-env"
else
  as_agency "pm2 start ecosystem.config.cjs"
fi
as_agency "pm2 save" >/dev/null
env PATH="$PATH" pm2 startup systemd -u "$A_USER" --hp "$SS_HOME/$A_USER" >/dev/null
wait_local_health "$A_PORT" || fail "The app does not answer on port $A_PORT. Look at: sudo -iu $A_USER pm2 logs $A_PM2"
if as_agency "npm run --silent db:backup -- --reason=manual" >/dev/null; then info "first encrypted backup made"
else warn "The first backup failed: check $BACKUP_KEY, then: sudo -iu $A_USER bash -lc 'cd app && npm run db:backup'"; fi
info "running on port $A_PORT"

log "8/9 Agency profile (name, logo, colours, contacts)"
if [ -n "$PROFILE" ]; then
  install_profile "$PROFILE"
else
  info "none given (--profile deploy/agencies/$SLUG): the agency fills its settings itself"
fi

log "9/9 Nginx and HTTPS"
# shellcheck disable=SC2086
ensure_certs $A_DOMAIN $A_REDIRECTS
write_site
if [ -n "$(https_health "$A_DOMAIN")" ]; then info "https://$A_DOMAIN answers"; else warn "https://$A_DOMAIN does not answer yet (DNS cache?). Check again in a few minutes."; fi

cat <<EOF

  Agency $SLUG is ready.

  Site:      https://$A_DOMAIN${A_REDIRECTS:+
  Forwards:  $A_REDIRECTS → https://$A_DOMAIN}
  Code:      $A_DIR        (user $A_USER, PM2 $A_PM2, port $A_PORT)
  Data:      $A_DATA       (encrypted backups every night at 03:00)

  Next step, the agency's Super Admin (only once, on the FINAL domain; to move
  the agency to its own domain first: bash deploy/agency-domain.sh $SLUG <domain>):

      sudo -iu $A_USER bash -lc 'cd app && npm run admin:setup'

  Open the printed link on https://$A_DOMAIN, set the password, add two security keys.
  Google sign-in: add https://$A_DOMAIN to the OAuth client (deploy/AGENCIES.md).
  Save $ENV in your password manager: it holds the keys to this agency's data.
EOF
