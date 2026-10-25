/** Hotel facilities shown as photo cards (restaurant, pool, spa…), matched from the hotel's service list. */
import { BOARD_LABEL, type BoardType } from '@/lib/hotels/types';

export type Facility = { id: string; title: string; text: string; photo: string };

const IMG = '/images/hotels';

const RULES: { id: string; test: RegExp; title: string; text: string; photo: (seed: number, label: string) => string }[] = [
  {
    id: 'restaurant',
    test: /مطعم|restaurant/i,
    title: 'المطعم',
    text: 'مطبخ محلي وعالمي على الغداء والعشاء، بأطباق حلال.',
    photo: (s) => `${IMG}/restaurant-${['fine', 'terrace', 'buffet'][s % 3]}.jpg`,
  },
  {
    id: 'breakfast',
    test: /إفطار|فطور|breakfast/i,
    title: 'إفطار بوفيه',
    text: 'بوفيه صباحي متنوّع: مخبوزات طازجة، فواكه، أجبان، بيض وقهوة.',
    photo: () => `${IMG}/facility-breakfast.jpg`,
  },
  {
    id: 'pool',
    test: /مسبح|pool/i,
    title: 'المسبح',
    text: 'مسبح مع مظلات وكراسي استلقاء ومناشف للنزلاء.',
    photo: (_s, label) => `${IMG}/facility-${/داخلي|مغطى|indoor/i.test(label) ? 'pool-indoor' : 'pool'}.jpg`,
  },
  {
    id: 'spa',
    test: /سبا|حمّام|حمام|spa/i,
    title: 'السبا والحمّام',
    text: 'تدليك، حمّام بخاري وجلسات استرخاء بالحجز المسبق.',
    photo: () => `${IMG}/facility-spa.jpg`,
  },
  {
    id: 'gym',
    test: /رياض|لياقة|gym|fitness/i,
    title: 'النادي الرياضي',
    text: 'أجهزة جري وأوزان حرة، مفتوح طوال اليوم.',
    photo: () => `${IMG}/facility-gym.jpg`,
  },
  {
    id: 'cafe',
    test: /مقهى|كافيه|cafe|café/i,
    title: 'المقهى',
    text: 'قهوة ومشروبات وحلويات في جلسة هادئة.',
    photo: () => `${IMG}/restaurant-terrace.jpg`,
  },
  {
    id: 'lobby',
    test: /استقبال|reception|كونسيرج/i,
    title: 'الاستقبال على مدار الساعة',
    text: 'فريق يساعدك في الدخول المبكر، الحجوزات والتنقل.',
    photo: (s) => `${IMG}/lobby-${s % 2 ? 'oriental' : 'modern'}.jpg`,
  },
];

function seedOf(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Facility cards for a hotel; the restaurant card lists the meal plans actually sold. */
export function hotelFacilities(hotelId: string, services: string[], boards: BoardType[] = []): Facility[] {
  const seed = seedOf(hotelId);
  const out: Facility[] = [];
  for (const rule of RULES) {
    const label = services.find((s) => rule.test.test(s));
    if (!label || out.some((f) => f.id === rule.id)) continue;
    let text = rule.text;
    if (rule.id === 'restaurant' && boards.length) {
      text = `${rule.text} الوجبات المتاحة مع الغرف: ${[...new Set(boards)].map((b) => BOARD_LABEL[b]).join('، ')}.`;
    }
    out.push({ id: rule.id, title: rule.id === 'pool' && /داخلي|مغطى/.test(label) ? 'مسبح داخلي' : rule.title, text, photo: rule.photo(seed, label) });
  }
  return out;
}
