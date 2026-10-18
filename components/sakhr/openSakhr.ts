/** Opens the floating Sakhr chat from anywhere on the page (e.g. a «اسأل صخر» button). */
export const SAKHR_OPEN_EVENT = 'ss:sakhr-open';
export const SAKHR_OPEN_KEY = 'ss_sakhr_open';

export function openSakhr() {
  // Sakhr loads after the page: if it is not mounted yet it opens as soon as it is.
  try {
    sessionStorage.setItem(SAKHR_OPEN_KEY, '1');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SAKHR_OPEN_EVENT));
}
