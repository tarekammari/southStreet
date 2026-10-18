/**
 * The agency's official address and phone: defaults for agency_settings and
 * the fallbacks used wherever the settings are not loaded (Sakhr, static pages).
 * The live values are edited by the admin in «صفحة عن الوكالة».
 */
export const AGENCY_ADDRESS = 'شارع خميستي الرئيسي، وسط مدينة الوادي';
export const AGENCY_CITY = 'ولاية الوادي';
export const AGENCY_COUNTRY = 'الجزائر';
export const AGENCY_FULL_ADDRESS = `${AGENCY_ADDRESS}، ${AGENCY_CITY}، ${AGENCY_COUNTRY}`;
export const AGENCY_PHONE = '039 39 39 39';
export const AGENCY_PHONE_TEL = '+21339393939';

/** `tel:` link in international form: a local Algerian number (0…) becomes +213…. */
export function telHref(phone: string): string {
  let n = phone.replace(/[^\d+]/g, '');
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  else if (n.startsWith('0')) n = `+213${n.slice(1)}`;
  return `tel:${n}`;
}
