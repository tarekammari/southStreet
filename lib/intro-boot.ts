/**
 * Shared by the server layout (inline boot script) and the client intro helpers.
 * `window.__ssIntro`: "playing" while the first-load splash is on screen,
 * "done" once it has lifted or was skipped (repeat visit, print page, reduced motion).
 * (A window flag, not an <html> attribute: React 19 resets <html> attributes on hydration.)
 */

export const INTRO_DONE_EVENT = 'ss:intro-done';
export const INTRO_SEEN_KEY = 'ss_intro_seen';

/**
 * Runs in <head> before first paint. Kept tiny and dependency-free.
 * When the intro is skipped it also releases the entrance animations that
 * app/motion.css holds while the (still server-rendered) splash is in the DOM.
 */
export const INTRO_BOOT_SCRIPT = `(function(){var skip=true;try{skip=!!sessionStorage.getItem('${INTRO_SEEN_KEY}')||/\\/print/.test(location.pathname)||matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}window.__ssIntro=skip?'done':'playing';if(skip){var s=document.createElement('style');s.textContent='.intro-splash{display:none!important}body *{animation-play-state:running!important}';document.head.appendChild(s)}})();`;
