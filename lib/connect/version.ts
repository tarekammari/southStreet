/**
 * Version of South Street Connect shown in the app ("حول التطبيق") and on /app.
 * Raise it with each Connect release; the build code after it changes on every deployment.
 */
export const CONNECT_VERSION = '1.3.0';

/** Build code of this deployment (git commit, set in next.config.js). */
export const BUILD_CODE = (process.env.APP_VERSION || '').slice(0, 7);

export const versionLabel = () => (BUILD_CODE ? `${CONNECT_VERSION} (${BUILD_CODE})` : CONNECT_VERSION);
