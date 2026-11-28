#!/usr/bin/env bash
# From the PC: run the tests, pack the app and install it on the VPS.   bash sites/mobile-store/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
VPS=${VPS:-root@45.9.190.236}
npm test --silent
TMP=$(mktemp -d)
tar -czf "$TMP/mobile-store.tgz" server.js package.json lib public scripts
ssh -o BatchMode=yes "$VPS" 'rm -rf /root/mobile-store-deploy && mkdir -p /root/mobile-store-deploy'
scp -q -o BatchMode=yes "$TMP/mobile-store.tgz" deploy/* "$VPS":/root/mobile-store-deploy/
ssh -o BatchMode=yes "$VPS" "SUPER_ADMIN_EMAILS='${SUPER_ADMIN_EMAILS:-}' bash /root/mobile-store-deploy/install.sh /root/mobile-store-deploy/mobile-store.tgz"
rm -rf "$TMP"
