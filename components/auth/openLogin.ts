/**
 * Ask the page to open its sign-in window (the navbar's LoginModal, or the
 * page's own). Used by Sakhr's open_sign_in tool. Returns false when no
 * sign-in window is on this page, so the caller can go to one instead.
 */
export type LoginRequest = {
  method: 'choose' | 'google' | 'password' | 'register';
  username?: string;
  /** Page to return to after signing in. */
  redirectTo?: string;
};

export const LOGIN_EVENT = 'ss:open-login';

export function openLogin(req: LoginRequest): boolean {
  const event = new CustomEvent<LoginRequest & { handled?: boolean }>(LOGIN_EVENT, { detail: { ...req } });
  window.dispatchEvent(event);
  return Boolean(event.detail.handled);
}
