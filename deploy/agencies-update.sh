#!/usr/bin/env bash
# Updates every agency, one after the other, with scripts/update.sh (backup, build
# beside the running version, zero-downtime switch, health check, rollback).
# Run as root on the VPS. Guide: deploy/AGENCIES.md
#
#   bash deploy/agencies-update.sh              latest commit of each install's branch
#   bash deploy/agencies-update.sh v1.7.0       a tag / branch / commit for all
#
# The first install (southstreet) goes first. Stops at the first agency whose new
# version does not answer (that agency is rolled back by update.sh; the next ones
# are not touched).
set -Eeuo pipefail
# shellcheck source=deploy/agency-lib.sh
. "$(dirname "$0")/agency-lib.sh"

REF="${1:-}"
need_root
register_legacy
mapfile -t SLUGS < <(all_slugs)
[ ${#SLUGS[@]} -gt 0 ] || fail "No agency yet (bash deploy/agency-add.sh <slug>)."
echo "Agencies: ${SLUGS[*]}${REF:+   →  $REF}"

done_list=()
for i in "${!SLUGS[@]}"; do
  load_agency "${SLUGS[$i]}"
  log "[$((i + 1))/${#SLUGS[@]}] $A_SLUG  (https://$A_DOMAIN, port $A_PORT)"
  if ! as_agency "bash scripts/update.sh ${REF:+$(printf %q "$REF")}"; then
    rest=("${SLUGS[@]:$((i + 1))}")
    fail "$A_SLUG failed (logs: sudo -iu $A_USER pm2 logs $A_PM2). Updated: ${done_list[*]:-none}. Not touched: ${rest[*]:-none}."
  fi
  if [ -z "$(local_health "$A_PORT")" ]; then
    fail "$A_SLUG does not answer on port $A_PORT after the update. Undo: sudo -iu $A_USER bash -lc 'cd app && ./scripts/update.sh --rollback'"
  fi
  [ -n "$(https_health "$A_DOMAIN")" ] || warn "https://$A_DOMAIN did not answer (the app itself does): check Nginx / the certificate."
  done_list+=("$A_SLUG")
done

log "All ${#done_list[@]} agencies updated"
bash "$(dirname "$0")/agency-list.sh"
