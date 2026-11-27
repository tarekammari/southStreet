/**
 * Version of Connect shown in the app ("حول التطبيق") and on /app.
 * Raise it with each Connect release; the build code after it changes on every deployment.
 */
export const CONNECT_VERSION = '1.8.1';

/**
 * Identity of this install's native apps. One install per agency builds its own apps
 * (deploy/connect-agency-build.sh) with CONNECT_APP_SLUG, e.g. `hebla`: Android package
 * tech.southstreet.connect.hebla, sign-in links ssconnect-hebla://. Empty: South Street's.
 */
export function nativeIdentity() {
  const raw = (process.env.CONNECT_APP_SLUG || '').trim().toLowerCase();
  const slug = /^[a-z][a-z0-9]{1,20}$/.test(raw) ? raw : '';
  const androidPackage = slug ? `tech.southstreet.connect.${slug}` : 'tech.southstreet.connect';
  // Once the app is published on Google Play (CONNECT_ON_PLAY=1), Android visitors install it from there.
  const onPlay = /^(1|true|yes)$/i.test((process.env.CONNECT_ON_PLAY || '').trim());
  return {
    androidPackage,
    scheme: slug ? `ssconnect-${slug}` : 'ssconnect',
    playUrl: onPlay ? `https://play.google.com/store/apps/details?id=${androidPackage}` : '',
  };
}

/** Build code of this deployment (git commit, set in next.config.js). */
export const BUILD_CODE = (process.env.APP_VERSION || '').slice(0, 7);

export const versionLabel = () => (BUILD_CODE ? `${CONNECT_VERSION} (${BUILD_CODE})` : CONNECT_VERSION);

/**
 * Latest native apps on the server (files in /var/www/connect-downloads, served
 * only to signed-in accounts by /api/connect/download). The apps compare these with
 * their own version each time they open and update themselves when older.
 * Raise them together with the build numbers in native/README.md, AFTER the
 * new files are uploaded (an app never installs a file that is not newer).
 */
export const NATIVE_RELEASES = {
  android: { versionCode: 9, versionName: '1.8.1', url: '/api/connect/download?platform=android' },
  windows: {
    version: '1.8.1',
    url: '/api/connect/download?platform=windows',
    /**
     * Light update (Windows 1.8.1+): only the app's own files, ~35 KB instead of the
     * ~77 MB installer — when `electron` is the runtime the app already has. Set
     * `sha256` to the SHA-256 of resources/app.asar (before gzip) of this build.
     */
    app: {
      version: '1.8.1',
      electron: '33.2.1',
      url: '/api/connect/download?platform=windows-app',
      sha256: '8d79d3bc64aa414b87a21912c649c57dec632a8d5ab7ef244af956b84b785f76',
    },
  },
} as const;
