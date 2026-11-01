/** Sakhr's connect_app tool asks the /app page to start installing Connect. */
export type ConnectInstallPlatform = 'auto' | 'android' | 'windows' | 'iphone';

export const CONNECT_INSTALL_EVENT = 'ss:connect-install';

/** Link to the download page that starts the install as soon as it opens. */
export function connectInstallHref(platform: ConnectInstallPlatform): string {
  return `/app?install=${platform}#install`;
}
