/**
 * «خلاص صخر» / «stop صخر»: said as a turn of a voice conversation, it ends the
 * conversation instead of being sent. Only the user's own transcribed turn is
 * checked, so Sakhr's voice can never trigger it.
 */

const DIACRITICS = /[ً-ْٰـ]/g;

/** Lower-case, no diacritics, one spelling for alef / taa marbuta / yaa, no punctuation. */
function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// «صخر» is sometimes heard as «صقر» / «سخر».
const NAME = /(?:^|\s)(?:صخر|صقر|سخر|ساخر|sakhr|sakher|sakhar|saker|sakar)(?=\s|$)/u;
const STOP_WORDS = /(?:^|\s)(?:خلاص|خلص|ستوب|stop|وقف|اوقف|توقف|كفى|كفايه|يكفي|باي|bye|اسكت|سكت|بسلامه|مع السلامه|يعطيك الصحه|شكرا|thanks|merci)(?=\s|$)/u;

/**
 * A short utterance such as «خلاص صخر», «stop sakhr» or just «خلاص». `assistant`
 * is the agency's own name for the assistant («RAZZAG AI»): its words count as the name too.
 */
export function isStopCommand(text: string, assistant = ''): boolean {
  const t = normalizeSpeech(text);
  const words = t.split(' ').filter(Boolean);
  if (!words.length || words.length > 5 || !STOP_WORDS.test(t)) return false;
  const own = normalizeSpeech(assistant).split(' ').filter((w) => w.length >= 3 && w !== 'ai');
  return NAME.test(t) || own.some((w) => words.includes(w)) || words.length <= 2;
}
