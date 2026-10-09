#!/usr/bin/env bash
#
# Update the app on the VPS to the latest version on GitHub (see DEPLOY.md).
#
#   ./scripts/update.sh            update to the latest commit of the current branch
#   ./scripts/update.sh v1.4.0     update to a tag (or any commit)
#   ./scripts/update.sh --rollback go back to the previous version
#
# Steps: backup → fetch → install → build into the idle folder (the site keeps
# running) → switch with a zero-downtime reload → health check → automatic
# rollback if the new version does not answer.
set -Eeuo pipefail

cd "$(dirname "$0")/.."
APP=south-street
PORT="${PORT:-3000}"
HEALTH="http://127.0.0.1:${PORT}/api/health"
STATE=.deploy-state            # previous commit + build folder, for --rollback
ACTIVE_FILE=.next-active

step() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

active_dir() { [ -f "$ACTIVE_FILE" ] && cat "$ACTIVE_FILE" || echo .next; }
idle_dir() { [ "$(active_dir)" = ".next-a" ] && echo .next-b || echo .next-a; }

wait_healthy() {
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 3 "$HEALTH" | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

switch_to() { # $1 = build folder
  echo "$1" > "$ACTIVE_FILE"
  NEXT_DIST_DIR="$1" pm2 reload ecosystem.config.cjs --only "$APP" --update-env
}

write_deploy_info() {
  printf '{"commit":"%s","deployedAt":"%s"}\n' "$(git rev-parse HEAD)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .deploy-info.json
}

if [ "${1:-}" = "--rollback" ]; then
  [ -f "$STATE" ] || fail "No previous version recorded."
  # shellcheck disable=SC1090
  . "$STATE"
  step "Rolling back to ${PREV_COMMIT:0:7} (${PREV_DIR})"
  git checkout -q "$PREV_COMMIT"
  npm ci --no-audit --no-fund
  switch_to "$PREV_DIR"
  wait_healthy || fail "Previous version is not answering either — check: pm2 logs $APP"
  write_deploy_info
  step "Rolled back. Now on $(git rev-parse --short HEAD)."
  exit 0
fi

TARGET="${1:-}"
PREV_COMMIT="$(git rev-parse HEAD)"
PREV_DIR="$(active_dir)"
NEW_DIR="$(idle_dir)"

step "1/6 Backup of the database"
npm run --silent db:backup -- --reason=pre-update

step "2/6 Fetching the new version"
git fetch --tags --quiet origin
if [ -n "$TARGET" ]; then
  git checkout -q "$TARGET"
else
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  [ "$BRANCH" = "HEAD" ] && fail "Detached HEAD: pass a version, e.g. ./scripts/update.sh main"
  git pull --ff-only --quiet origin "$BRANCH"
fi
NEW_COMMIT="$(git rev-parse HEAD)"
if [ "$NEW_COMMIT" = "$PREV_COMMIT" ] && [ -d "$PREV_DIR" ]; then
  step "Already up to date (${NEW_COMMIT:0:7})."
  exit 0
fi
echo "   ${PREV_COMMIT:0:7} → ${NEW_COMMIT:0:7}"
git --no-pager log --oneline "${PREV_COMMIT}..${NEW_COMMIT}" | head -20 || true

rollback_code() {
  printf '\n\033[1;33m↺ Restoring the previous code (%s)\033[0m\n' "${PREV_COMMIT:0:7}"
  git checkout -q "$PREV_COMMIT"
  npm ci --no-audit --no-fund >/dev/null 2>&1 || true
}

step "3/6 Installing dependencies"
npm ci --no-audit --no-fund || { rollback_code; fail "npm ci failed — nothing was switched."; }

step "4/6 Building into ${NEW_DIR} (the site keeps running)"
rm -rf "$NEW_DIR"
NEXT_DIST_DIR="$NEW_DIR" npm run build || { rollback_code; fail "Build failed — the site still runs the previous version."; }

printf 'PREV_COMMIT=%s\nPREV_DIR=%s\n' "$PREV_COMMIT" "$PREV_DIR" > "$STATE"

step "5/6 Switching to the new version"
switch_to "$NEW_DIR"

step "6/6 Health check"
if wait_healthy; then
  write_deploy_info
  step "Updated to ${NEW_COMMIT:0:7}. $(curl -fsS "$HEALTH")"
else
  printf '\n\033[1;31m✖ New version did not answer — rolling back automatically.\033[0m\n' >&2
  rollback_code
  switch_to "$PREV_DIR"
  wait_healthy && fail "Rolled back to ${PREV_COMMIT:0:7}. See: pm2 logs $APP" || fail "Rollback did not answer either. See: pm2 logs $APP"
fi
