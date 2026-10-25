#!/usr/bin/env bash
# Moves an agency to its own domain. The old addresses keep working and forward there.
# Run as root on the VPS. Guide: deploy/AGENCIES.md
#
#   bash deploy/agency-domain.sh <slug> <domain>        e.g.  acme www.acme-voyages.dz
#
# Point the domain's A record to the VPS first. Security keys belong to one address:
# after the move, the agency's admins register their keys again (printed at the end).
set -Eeuo pipefail
# shellcheck source=deploy/agency-lib.sh
. "$(dirname "$0")/agency-lib.sh"

SLUG="${1:-}" DOMAIN="${2:-}"
if [ -z "$SLUG" ] || [ -z "$DOMAIN" ]; then echo "Usage: bash deploy/agency-domain.sh <slug> <domain>"; exit 1; fi
DOMAIN="${DOMAIN,,}"

need_root
need_tools
register_legacy
load_agency "$SLUG" || fail "No agency '$SLUG' (see: bash deploy/agency-list.sh)."
valid_domain "$DOMAIN" || fail "Not a domain name: $DOMAIN"
if [ "$A_NGINX" != 1 ]; then
  fail "'$SLUG' is the first install: move it with   DOMAIN=$DOMAIN bash deploy/hostinger-setup.sh"
fi

OLD="$A_DOMAIN"
ENV="$A_DIR/.env"
# Everything that answered before keeps answering, as a forward to the new domain.
redirects=" $A_REDIRECTS $OLD "
# www.example.dz: example.dz forwards too, when it points here.
if [[ "$DOMAIN" == www.* ]] && check_dns "${DOMAIN#www.}" 2>/dev/null; then redirects+=" ${DOMAIN#www.} "; fi
NEW_REDIRECTS=""
for h in $redirects; do
  [ "$h" = "$DOMAIN" ] && continue
  [[ " $NEW_REDIRECTS " == *" $h "* ]] || NEW_REDIRECTS="${NEW_REDIRECTS:+$NEW_REDIRECTS }$h"
done

log "1/5 DNS for $DOMAIN"
check_dns "$DOMAIN" || fail "$DOMAIN must point to this server first (A record, see deploy/AGENCIES.md). Wait a few minutes after changing it."
info "points to this server"

log "2/5 Certificates"
# shellcheck disable=SC2086
ensure_certs "$DOMAIN" $NEW_REDIRECTS

if [ "$OLD" = "$DOMAIN" ]; then
  info "$SLUG already answers on $DOMAIN: Nginx refreshed, nothing else changes."
  A_REDIRECTS="$NEW_REDIRECTS"
  save_agency
  write_site
  exit 0
fi

log "3/5 App settings → https://$DOMAIN"
cp -p "$ENV" "$ENV.before-domain"
env_set_domain "$ENV" "$DOMAIN"
# Rebuild the same version: page metadata (links, previews) carries the address.
# Zero downtime, health check and rollback come from scripts/update.sh.
REF="$(sudo -u "$A_USER" git -C "$A_DIR" rev-parse --abbrev-ref HEAD)"   # stay on the branch
[ "$REF" != HEAD ] || REF="$(sudo -u "$A_USER" git -C "$A_DIR" rev-parse HEAD)"
if ! as_agency "REBUILD=1 bash scripts/update.sh $(printf %q "$REF")"; then
  mv "$ENV.before-domain" "$ENV"
  as_agency "pm2 reload ecosystem.config.cjs --only $A_PM2 --update-env" || true
  fail "The rebuild failed: settings put back, $SLUG still runs on https://$OLD."
fi
rm -f "$ENV.before-domain"

log "4/5 Nginx: https://$DOMAIN, forwards from $NEW_REDIRECTS"
A_DOMAIN="$DOMAIN" A_REDIRECTS="$NEW_REDIRECTS"
save_agency
write_site

log "5/5 Check"
if [ -n "$(https_health "$DOMAIN")" ]; then info "https://$DOMAIN answers"; else warn "https://$DOMAIN does not answer yet: check again in a few minutes."; fi
security_key_warning "$DOMAIN"
