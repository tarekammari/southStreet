/**
 * Text → what a voice should actually say, for the assistant's spoken replies.
 *
 *  - Money: «160600.00 دج», «دج 160600.00», «185.000 دج», «160,600 DZD» become
 *    Arabic words: «مئة وستون ألفاً وستمئة دينار جزائري». A voice reading the
 *    digits says "one six zero six zero zero point zero zero" or gets the
 *    grouping dot wrong.
 *  - Emails: «rh-tours@yahoo.fr» becomes «rh tours آت ياهو دوت إف آر», so each part is
 *    read as a word instead of letter by letter.
 *  - Links (web addresses, page paths) are not read: they become «اضغط على الرابط».
 *
 * Pure and idempotent (a second pass changes nothing): used on the page before
 * the reply is cut into sentences, and again by the speech API.
 */

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

/** 0–999 in words («ستة وعشرون», «مئة وستون»). */
function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else {
      const u = r % 10;
      parts.push(u ? `${ONES[u]} و${TENS[Math.floor(r / 10)]}` : TENS[Math.floor(r / 10)]);
    }
  }
  return parts.join(' و');
}

type Forms = { one: string; two: string; few: string; many: string };
const THOUSAND: Forms = { one: 'ألف', two: 'ألفان', few: 'آلاف', many: 'ألفاً' };
const MILLION: Forms = { one: 'مليون', two: 'مليونان', few: 'ملايين', many: 'مليوناً' };
const BILLION: Forms = { one: 'مليار', two: 'ملياران', few: 'مليارات', many: 'ملياراً' };

/** «ثلاثة آلاف», «أحد عشر ألفاً», «مئة ألف», «ألفان». */
function counted(n: number, f: Forms): string {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${below1000(n)} ${f.few}`;
  if (r >= 11) return `${below1000(n)} ${f.many}`;
  return `${below1000(n)} ${f.one}`;
}

/** Whole numbers to Arabic words, up to hundreds of billions. */
export function arabicNumberWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return 'صفر';
  const parts: string[] = [];
  const b = Math.floor(n / 1e9); n %= 1e9;
  const m = Math.floor(n / 1e6); n %= 1e6;
  const t = Math.floor(n / 1e3); n %= 1e3;
  if (b) parts.push(counted(b, BILLION));
  if (m) parts.push(counted(m, MILLION));
  if (t) parts.push(counted(t, THOUSAND));
  if (n) parts.push(below1000(n));
  return parts.join(' و');
}

type Currency = Forms & { tail?: string };
const DINAR: Currency = { one: 'دينار جزائري', two: 'ديناران جزائريان', few: 'دنانير جزائرية', many: 'ديناراً جزائرياً' };
const RIYAL: Currency = { one: 'ريال سعودي', two: 'ريالان سعوديان', few: 'ريالات سعودية', many: 'ريالاً سعودياً' };
const EURO: Currency = { one: 'يورو', two: 'يورو', few: 'يورو', many: 'يورو' };
const DOLLAR: Currency = { one: 'دولار', two: 'دولاران', few: 'دولارات', many: 'دولاراً' };

/** «مئة وستون ألفاً وستمئة دينار جزائري», with the noun in the right number form. */
export function spokenAmount(value: number, cur: Currency = DINAR): string {
  const n = Math.round(Math.abs(value));
  if (n === 1) return cur.one;
  if (n === 2) return cur.two;
  const r = n % 100;
  const noun = r >= 3 && r <= 10 ? cur.few : r >= 11 ? cur.many : cur.one;
  // A round amount ends on «ألف/مليون» directly before the noun: «مئة ألف دينار», not «… ألفاً دينار».
  const words = arabicNumberWords(n).replace(/(ألفاً|مليوناً|ملياراً|ألفان|مليونان|ملياران)$/, (w) => ({ 'ألفاً': 'ألف', 'مليوناً': 'مليون', 'ملياراً': 'مليار', 'ألفان': 'ألفا', 'مليونان': 'مليونا', 'ملياران': 'مليارا' })[w] as string);
  return `${words} ${noun}`;
}

/** "160600.00", "185.000", "160,600", "160 600" → 160600 (a 1–2 digit tail is decimals). */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/[  ٬ ]/g, ' ').trim();
  const decimal = s.match(/^(.*\d)[.,٫](\d{1,2})$/);
  const whole = (decimal ? decimal[1] : s).replace(/[.,٫٬ ]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const n = Number(whole) + (decimal ? Number(`0.${decimal[2]}`) : 0);
  return Number.isFinite(n) ? n : null;
}

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const NUM = String.raw`\d{1,3}(?:[.,  ٬ ]\d{3})+(?:[.,٫]\d{1,2})?|\d+(?:[.,٫]\d{1,2})?`;
const CUR = String.raw`دج|د\.\s?ج|DZD|DA\b|دينار(?:اً|ا)?(?:\s+جزائري(?:اً|ا)?)?|دنانير(?:\s+جزائرية)?|ريال(?:اً|ا)?(?:\s+سعودي(?:اً|ا)?)?|SAR|ر\.\s?س|€|EUR|يورو|\$|USD|دولار(?:اً|ا)?`;

function currencyOf(token: string): Currency {
  if (/ريال|SAR|ر\.\s?س/i.test(token)) return RIYAL;
  if (/€|EUR|يورو/i.test(token)) return EURO;
  if (/\$|USD|دولار/i.test(token)) return DOLLAR;
  return DINAR;
}

/** Common mail providers and endings, written as an Arabic voice should say them. */
const HOST_WORDS: Record<string, string> = {
  gmail: 'جيميل', yahoo: 'ياهو', hotmail: 'هوتميل', outlook: 'أوتلوك', live: 'لايف', icloud: 'آي كلاود', aol: 'إيه أو إل',
  com: 'كوم', net: 'نت', org: 'أورغ', fr: 'إف آر', dz: 'دي زد', tech: 'تك', sa: 'إس إيه', info: 'إنفو', io: 'آي أو', app: 'آب',
};
const hostWords = (host: string) => host.split('.').map((p) => HOST_WORDS[p.toLowerCase()] || p.replace(/-/g, ' ')).join(' دوت ');

/** What the voice says instead of reading a link. */
const CLICK = 'اضغط على الرابط اللي تحت';
/** Stands in for each link while the text is being prepared (an invisible separator, never spoken). */
const LINK_MARK = '⁣LINK⁣';
const LINK_LABEL = new RegExp(`(?:الرابط|رابط|link|lien)\\s*[:：]?\\s*${LINK_MARK}`, 'gi');
const CLICK_REPEATS = new RegExp(`(${CLICK}[\\s،,.:]*){2,}`, 'g');

/** Money and emails → words a voice reads naturally; links → «اضغط على الرابط». */
export function spokenForms(text: string): string {
  // Unicode hyphens (the model sometimes writes «rh‑tours» with U+2011) count as plain hyphens.
  let s = toLatinDigits(text).replace(/[‐-―−]/g, '-');

  // Emails: the parts as words ("rh tours آت yahoo دوت fr").
  s = s.replace(/\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)\b/g, (_m, user: string, host: string) =>
    ` ${user.replace(/[._%+-]+/g, ' ').trim()} آت ${hostWords(host)} `
  );
  // Links are never read out: a web address or a page path («/hotels/…?checkIn=…») becomes
  // «اضغط على الرابط» (the link itself is on screen), and a «رابط:» label before it is dropped.
  // When the reply already says «اضغط على الرابط …» itself, the links are simply left unsaid.
  // A list of hotels has one link per line: the phrase is said once, where the last link was.
  const saysClick = /اضغط على الرابط|انقر على الرابط/.test(s);
  s = s.replace(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|dz|tech|fr|sa|info|io|app)(?:\/[^\s]*)?/gi, ` ${LINK_MARK} `);
  s = s.replace(/(^|[\s(«"'])\/[a-z][\w\-./%]*(?:\?[^\s)»"']*)?/gi, `$1${LINK_MARK} `);
  s = s.replace(LINK_LABEL, LINK_MARK);
  const marks = s.split(LINK_MARK).length - 1;
  if (marks) {
    let seen = 0;
    s = s.split(LINK_MARK).reduce((acc, part) => acc + (seen++ === 0 ? '' : seen - 1 === marks && !saysClick ? CLICK : '') + part, '');
  }
  s = s.replace(CLICK_REPEATS, `${CLICK} `).replace(/\s+([.،,:])/g, '$1');

  // Currency after the amount ("160600.00 دج") and before it ("دج 160600.00").
  s = s.replace(new RegExp(`(${NUM})\\s*(${CUR})`, 'g'), (m, num: string, cur: string) => {
    const n = parseAmount(num);
    return n == null ? m : spokenAmount(n, currencyOf(cur));
  });
  s = s.replace(new RegExp(`(${CUR})\\s*(${NUM})`, 'g'), (m, cur: string, num: string) => {
    const n = parseAmount(num);
    return n == null ? m : spokenAmount(n, currencyOf(cur));
  });
  // A bare amount with zero cents ("160600.00") is still money: read it as a whole number.
  s = s.replace(/\b(\d{4,})[.,]00\b/g, (_m, num: string) => arabicNumberWords(Number(num)));

  return s.replace(/\s{2,}/g, ' ').trim();
}
