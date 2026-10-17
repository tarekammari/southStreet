# South Street Connect — native apps

The apps show the Connect web app (`/connect`, always the latest version from
the server) and add what a website cannot do: a real call screen, a looping
ringtone and running in the background.

| App | Folder | Built on | Download |
|---|---|---|---|
| Android | `android/` (Kotlin, no framework) | the VPS (command-line Android SDK, no Android Studio) | `/api/connect/download?platform=android` (signed in) |
| Windows | `windows/` (Electron) | this PC | `/api/connect/download?platform=windows` (signed in) |

The ringtones (`ringtone.wav`, the original, and `ringtone_<id>.wav`: space and
calm nature tones) are rendered by `npm run connect:ringtones` from
`lib/connect/ringtones.ts`, the same code the web app plays, straight into both
apps. The tone picked in «حول التطبيق» is saved on the device and told to the app
(Android: `SSAndroid.setRingtone`, Windows: the `ringtone` field of the call state).

## Android

What it does: full-screen incoming call over the lock screen (wakes the phone),
CallStyle notification with Answer / Decline, the ringtone looping with rising
volume (follows ring / vibrate / silent), an "ongoing call" notification with
Hang up that keeps the call alive with the screen off.

**Build** (from the project folder on this PC):

```bash
cd native && tar -czf - --exclude=build --exclude=.gradle android | ssh root@45.9.190.236 'rm -rf /home/builder/connect-android && mkdir -p /tmp/up && tar -xzf - -C /tmp/up && mv /tmp/up/android /home/builder/connect-android && cp /home/builder/google-services.json /home/builder/connect-android/app/ 2>/dev/null; chown -R builder:builder /home/builder/connect-android'
ssh root@45.9.190.236 'su - builder -c "cd ~/connect-android && echo sdk.dir=/opt/android-sdk > local.properties && SS_KEYSTORE=~/keys/connect.p12 SS_KEYSTORE_PASSWORD=\$(cat ~/keys/pass) SS_VERSION_CODE=6 SS_VERSION_NAME=1.6.1 /opt/gradle-8.11.1/bin/gradle --no-daemon -q assembleRelease" && cp /home/builder/connect-android/app/build/outputs/apk/release/app-release.apk /var/www/connect-downloads/SouthStreetConnect.apk'
```

Raise `SS_VERSION_CODE` on every build (phones only update to a higher number).

## Updates (from 1.6.0 the apps update themselves)

Each time an app opens (and every 6 hours) it asks `/api/connect/app-version`
for the newest version. Android downloads the APK in the background, checks it
is this app with a higher version code, then asks once «تحديث الآن» (Android
always shows its own "Install" confirmation for apps outside the Play Store).
Windows downloads the installer and installs it silently while in the tray, or
after one question while the window is open. Never during a call.

To release a new version:

1. Build with higher numbers (Android `SS_VERSION_CODE` / `SS_VERSION_NAME`,
   Windows `version` in `windows/package.json`) and upload the files to `/downloads`.
2. Then set the same numbers in `NATIVE_RELEASES` (`lib/connect/version.ts`) and deploy.

Apps older than 1.6.0 cannot update themselves: the Connect page shows them a
banner that downloads the new app in the browser (install it once by hand).

**Signing key**: `/home/builder/keys/connect.p12` + `pass` on the VPS. Keep a copy
somewhere safe: an update must be signed with the same key, or phones refuse it.

**Firebase (ringing while the app is closed)** — needed once:

1. https://console.firebase.google.com → Add project → name it "South Street Connect" (Analytics: off).
2. Add app → Android → package name `tech.southstreet.connect` → Register → download `google-services.json`.
3. Project settings → Service accounts → Generate new private key (a JSON file).
4. Put `google-services.json` at `/home/builder/google-services.json` on the VPS and rebuild.
5. Server: add `FIREBASE_SERVICE_ACCOUNT_B64=<base64 of the private-key JSON>` to `~southstreet/app/.env`, then `./scripts/update.sh`.

## Windows

What it does: starts with Windows and stays in the tray (closing the window keeps
it running), keeps the live connection open, shows an always-on-top call card
with the ringtone and Answer / Decline when a call comes in, and the same card
(timer, mute, hang up) during a call while the main window is out of sight.

```bash
cd native/windows && npm install && npx electron-builder --win nsis --x64 --publish never
scp dist/SouthStreetConnect-Setup-*.exe root@45.9.190.236:/var/www/connect-downloads/SouthStreetConnect-Setup.exe
```

The installer is not code-signed: Windows SmartScreen shows "More info → Run anyway"
until a code-signing certificate is bought.
