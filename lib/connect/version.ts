/**
 * Version of South Street Connect shown in the app ("حول التطبيق") and on /app.
 * Raise it with each Connect release; the build code after it changes on every deployment.
 */
export const CONNECT_VERSION = '1.7.0';

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
  android: { versionCode: 6, versionName: '1.6.1', url: '/api/connect/download?platform=android' },
  windows: { version: '1.6.0', url: '/api/connect/download?platform=windows' },
} as const;
