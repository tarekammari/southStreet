#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build an agency's OWN Connect apps (Android + Windows), so its customers'
# apps talk to the agency's server, carry its name and icon, and install next
# to other agencies' apps.
#
#   deploy/connect-agency-build.sh <agency-folder> <install-slug> [android|windows|all]
#   e.g. deploy/connect-agency-build.sh deploy/agencies/hebla-tours hebla-tours
#
# Run from the project folder on the PC (Git Bash). Needs:
#   <agency-folder>/connect/connect.json   {slug, origin, name, longName, fileName}
#   <agency-folder>/connect/android-xxhdpi.png, android-xxxhdpi.png, icon-512.png
# Android is built on the VPS (user builder, same signing key as South Street —
# a different package, so that is fine); Windows on this PC with the
# electron-builder of the main checkout (D:/data/south_street/native/windows).
# Files go to /var/www/connect-downloads-<install-slug>/ (served by that
# install when its .env has CONNECT_DOWNLOADS_DIR pointing there).
# Version numbers come from NATIVE_RELEASES in lib/connect/version.ts.
#
# Firebase (calls ring while the Android app is closed): put the agency's
# google-services.json (for package tech.southstreet.connect.<slug>) at
# /home/builder/google-services-<slug>.json before building.
# ---------------------------------------------------------------------------
set -euo pipefail

AGENCY_DIR="${1:?agency folder, e.g. deploy/agencies/hebla-tours}"
INSTALL="${2:?install slug, e.g. hebla-tours}"
WHAT="${3:-all}"
VPS="${VPS:-root@45.9.190.236}"
CFG="$AGENCY_DIR/connect/connect.json"
[ -f "$CFG" ] || { echo "Missing $CFG"; exit 1; }

json() { node -e "const c=require(require('path').resolve(process.argv[1]));process.stdout.write(String(c[process.argv[2]]||''))" "$CFG" "$1"; }
SLUG="$(json slug)"; ORIGIN="$(json origin)"; NAME="$(json name)"; LONG="$(json longName)"; FILE="$(json fileName)"
[[ "$SLUG" =~ ^[a-z][a-z0-9]{1,20}$ ]] || { echo "Bad slug '$SLUG'"; exit 1; }
VCODE="$(node -e "const s=require('fs').readFileSync('lib/connect/version.ts','utf8');process.stdout.write(s.match(/versionCode:\s*(\d+)/)[1])")"
VNAME="$(node -e "const s=require('fs').readFileSync('lib/connect/version.ts','utf8');process.stdout.write(s.match(/versionName:\s*'([^']+)'/)[1])")"
DL="/var/www/connect-downloads-$INSTALL"
echo "▶ $LONG ($SLUG) → $ORIGIN, version $VNAME ($VCODE), files in $DL"

build_android() {
  local B="/home/builder/connect-android-$SLUG"
  echo "▶ Android: upload sources"
  tar -czf - --exclude=build --exclude=.gradle -C native android | ssh "$VPS" "rm -rf $B /tmp/up-$SLUG && mkdir -p /tmp/up-$SLUG && tar -xzf - -C /tmp/up-$SLUG && mv /tmp/up-$SLUG/android $B && rmdir /tmp/up-$SLUG"
  ssh "$VPS" "cat > $B/app/src/main/res/mipmap-xxhdpi/ic_launcher.png" < "$AGENCY_DIR/connect/android-xxhdpi.png"
  ssh "$VPS" "cat > $B/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" < "$AGENCY_DIR/connect/android-xxxhdpi.png"
  # Settings for the build (a file, so names with spaces need no shell quoting).
  printf 'export SS_APP_SLUG=%q SS_ORIGIN=%q SS_APP_NAME=%q SS_APP_LONG_NAME=%q SS_VERSION_CODE=%q SS_VERSION_NAME=%q\n' \
    "$SLUG" "$ORIGIN" "$NAME" "$LONG" "$VCODE" "$VNAME" | ssh "$VPS" "cat > $B/agency.env"
  echo "▶ Android: build on the VPS (a few minutes)"
  ssh "$VPS" "set -e
    if [ -f /home/builder/google-services-$SLUG.json ]; then cp /home/builder/google-services-$SLUG.json $B/app/google-services.json; echo '  Firebase: on'; else echo '  Firebase: not set up for $SLUG (closed app rings through its background listener only)'; fi
    chown -R builder:builder $B
    su - builder -c 'cd $B && . ./agency.env && echo sdk.dir=/opt/android-sdk > local.properties && SS_KEYSTORE=~/keys/connect.p12 SS_KEYSTORE_PASSWORD=\$(cat ~/keys/pass) /opt/gradle-8.11.1/bin/gradle --no-daemon -q assembleRelease'
    mkdir -p $DL && chmod 755 $DL
    cp $B/app/build/outputs/apk/release/app-release.apk $DL/SouthStreetConnect.apk && chmod 644 $DL/SouthStreetConnect.apk
    ls -la $DL/SouthStreetConnect.apk"
}

build_windows() {
  local MAIN_WIN="${MAIN_WIN:-D:/data/south_street/native/windows}"
  [ -x "$MAIN_WIN/node_modules/.bin/electron-builder" ] || { echo "electron-builder not found in $MAIN_WIN/node_modules"; exit 1; }
  local T; T="$(mktemp -d)"
  echo "▶ Windows: build in $T"
  cp native/windows/{main.js,preload.js,updates.js,call.html,call-preload.js,package.json} "$T/"
  cp -r native/windows/assets native/windows/build "$T/"
  # Same electron / electron-builder as the main checkout (a folder link, no copy).
  powershell -NoProfile -Command "New-Item -ItemType Junction -Path '$(cygpath -w "$T/node_modules")' -Target '$(cygpath -w "$MAIN_WIN/node_modules")' | Out-Null"
  mkdir -p "$T/agency"
  node -e "require('fs').writeFileSync(process.argv[1], JSON.stringify({origin:process.argv[2],name:process.argv[3],scheme:'ssconnect-'+process.argv[4],appId:'tech.southstreet.connect.'+process.argv[4]},null,2))" "$T/agency/brand.json" "$ORIGIN" "$LONG" "$SLUG"
  cp "$AGENCY_DIR/connect/icon-512.png" "$T/agency/brand-icon.png"
  cp "$AGENCY_DIR/connect/icon-512.png" "$T/build/icon.png"
  # The installer's own identity: its id, name, shortcut and sign-in link scheme.
  node -e "
    const fs=require('fs'), p=process.argv[1]+'/package.json', pkg=JSON.parse(fs.readFileSync(p,'utf8'));
    const [ , , slug, long, file] = process.argv;
    const b = pkg.build;
    b.appId = 'tech.southstreet.connect.' + slug;
    b.productName = long;
    b.artifactName = file + '-Setup-\${version}.exe';
    b.nsis.shortcutName = long;
    b.protocols = [{ name: long, schemes: ['ssconnect-' + slug] }];
    b.extraResources.push({ from: 'agency', to: '.', filter: ['brand.json', 'brand-icon.png'] });
    pkg.productName = long; pkg.name = 'connect-' + slug; pkg.description = long + ' for Windows';
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
  " "$T" "$SLUG" "$LONG" "$FILE"
  (cd "$T" && ./node_modules/.bin/electron-builder --win nsis --x64 --publish never >/dev/null)
  local EXE; EXE="$(ls "$T"/dist/*-Setup-*.exe | head -1)"
  echo "▶ Windows: upload $(basename "$EXE")"
  ssh "$VPS" "mkdir -p $DL && chmod 755 $DL && cat > $DL/SouthStreetConnect-Setup.exe && chmod 644 $DL/SouthStreetConnect-Setup.exe && ls -la $DL/SouthStreetConnect-Setup.exe" < "$EXE"
  powershell -NoProfile -Command "(Get-Item '$(cygpath -w "$T/node_modules")').Delete()"  # the link only, not the main checkout's files
  rm -rf "$T"
}

case "$WHAT" in
  android) build_android ;;
  windows) build_windows ;;
  all) build_android; build_windows ;;
  *) echo "android | windows | all"; exit 1 ;;
esac

cat <<EOF
✔ Done. The install's .env needs (once):
  CONNECT_APP_SLUG=$SLUG
  CONNECT_DOWNLOADS_DIR=$DL
  CONNECT_DOWNLOAD_NAME=$FILE
EOF
