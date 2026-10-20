const unsplash = (id: string, w: number) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=70`;
const local = (name: string) => `/images/destinations/${name}.jpg`;

const COVERS: Record<string, string> = {
  MAKKAH: 'photo-1565552645632-d725f8bfc19a',
  MADINAH: 'photo-1591604129939-f1efa4d9f7fa',
  TR: 'photo-1524231757912-21f4fe3a7200',
  MY: 'photo-1596422846543-75c6fc197f07',
  EG: 'photo-1539650116574-8efeb43e2750',
  ES: 'photo-1583422409516-2895a77efded',
  GB: 'photo-1513635269975-59663e0ac1ad',
};
const LOCAL_COVERS: Record<string, string> = { TN: 'dest-tn', DZ: 'dest-dz' };

/** Cover photo of a destination (TR, MY…, MAKKAH, MADINAH); '' when there is none. */
export function destinationPhoto(id: string, width = 640): string {
  if (LOCAL_COVERS[id]) return local(LOCAL_COVERS[id]);
  return COVERS[id] ? unsplash(COVERS[id], width) : '';
}

const CITIES: Record<string, string> = {
  'إسطنبول': unsplash(COVERS.TR, 900),
  'كابادوكيا': local('city-tr-cappadocia'),
  'أنطاليا': local('city-tr-antalya'),
  'طرابزون': local('city-tr-trabzon'),
  'كوالالمبور': unsplash(COVERS.MY, 900),
  'لنكاوي': local('city-my-langkawi'),
  'بينانغ': local('city-my-penang'),
  'ملاكا': local('city-my-malacca'),
  'القاهرة': unsplash(COVERS.EG, 900),
  'شرم الشيخ': local('city-eg-sharm'),
  'الأقصر': local('city-eg-luxor'),
  'الإسكندرية': local('city-eg-alexandria'),
  'تونس العاصمة': local('city-tn-tunis'),
  'الحمامات': local('city-tn-hammamet'),
  'جربة': local('city-tn-djerba'),
  'سوسة': local('city-tn-sousse'),
  'برشلونة': unsplash(COVERS.ES, 900),
  'مدريد': local('city-es-madrid'),
  'غرناطة': local('city-es-granada'),
  'إشبيلية': local('city-es-seville'),
  'لندن': unsplash(COVERS.GB, 900),
  'إدنبرة': local('city-gb-edinburgh'),
  'مانشستر': local('city-gb-manchester'),
  'أكسفورد': local('city-gb-oxford'),
  'الجزائر العاصمة': local('city-dz-algiers'),
  'وهران': local('city-dz-oran'),
  'قسنطينة': local('city-dz-constantine'),
  'الوادي': local('city-dz-eloued'),
  'غرداية': local('city-dz-ghardaia'),
  'جانت': local('dest-dz'),
};

/** Photo of a city by its Arabic name ('' when there is none). */
export function cityPhoto(city: string): string {
  return CITIES[city] || '';
}
