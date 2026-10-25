#!/usr/bin/env bash
# Lists the agencies on this VPS: slug, port, version, health, memory, addresses.
# Run as root on the VPS. Guide: deploy/AGENCIES.md
#
#   bash deploy/agency-list.sh
set -Eeuo pipefail
# shellcheck source=deploy/agency-lib.sh
. "$(dirname "$0")/agency-lib.sh"

need_root
register_legacy >/dev/null

json_field() { # json key
  sed -n "s/.*\"$2\":\"\{0,1\}\([^\",}]*\).*/\1/p" <<<"$1"
}

# Memory of the process listening on the port (Next.js' server), in MB.
port_mem() {
  local pid
  pid="$(ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n 1 | cut -d= -f2)"
  [ -n "$pid" ] || { echo "-"; return; }
  ps -o rss= -p "$pid" 2>/dev/null | awk '{ printf "%d MB", $1 / 1024 }'
}

FMT='%-16s %-6s %-16s %-6s %-6s %-8s %s\n'
# shellcheck disable=SC2059
printf "$FMT" SLUG PORT VERSION APP HTTPS MEMORY DOMAINS
n=0
for slug in $(all_slugs); do
  load_agency "$slug" || continue
  n=$((n + 1))
  health="$(local_health "$A_PORT")"
  if [ -n "$health" ]; then
    app=ok
    version="$(json_field "$health" version)"
    commit="$(json_field "$health" commit)"
    version="${version}${commit:+ $commit}"
  else
    app=DOWN
    version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$A_DIR/package.json" 2>/dev/null | head -n 1)"
  fi
  if [ -n "$(https_health "$A_DOMAIN")" ]; then https=ok; else https=DOWN; fi
  domains="$A_DOMAIN"
  for h in $A_REDIRECTS; do domains+=" ($h →)"; done
  # shellcheck disable=SC2059
  printf "$FMT" "$A_SLUG" "$A_PORT" "${version:--}" "$app" "$https" "$(port_mem "$A_PORT")" "$domains"
done
[ $n -gt 0 ] || echo "(no agency yet: bash deploy/agency-add.sh <slug>)"
if command -v free >/dev/null; then
  free -m | awk '/^Mem:/ { printf "\nServer memory: %d MB used of %d MB, %d MB available\n", $3, $2, $7 }'
fi
