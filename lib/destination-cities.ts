/**
 * The cities of the destinations (lib/tour.ts): the address of their page
 * (/destinations/TR/istanbul), their Latin name and a short description.
 */
import { normAr } from '@/lib/hotels/types';

export type CityInfo = { slug: string; latin: string; blurb: string };

const INFO: Record<string, CityInfo> = {
  'إسطنبول': { slug: 'istanbul', latin: 'ISTANBUL', blurb: 'مدينة على قارتين: آيا صوفيا والمسجد الأزرق، البازار الكبير ورحلات البوسفور. فنادق في السلطان أحمد وتقسيم وعلى ضفاف البحر.' },
  'بورصة': { slug: 'bursa', latin: 'BURSA', blurb: 'أول عاصمة عثمانية: الجامع الأخضر، الأسواق القديمة، الحمّامات الحرارية والتلفريك إلى جبل أولوداغ.' },
  'طرابزون': { slug: 'trabzon', latin: 'TRABZON', blurb: 'طبيعة البحر الأسود الخضراء: بحيرة أوزنجول، دير سوميلا وهضاب الضباب. فنادق بإطلالة على الجبال والبحر.' },
  'أنطاليا': { slug: 'antalya', latin: 'ANTALYA', blurb: 'شواطئ الريفييرا التركية والبلدة القديمة كاليتشي وشلالات دودان. منتجعات شاملة كلياً على البحر.' },
  'كابادوكيا': { slug: 'cappadocia', latin: 'CAPPADOCIA', blurb: 'مداخن الجن والمناطيد عند الفجر، المدن تحت الأرض وفنادق الكهوف الحجرية.' },
  'إزمير': { slug: 'izmir', latin: 'IZMIR', blurb: 'لؤلؤة بحر إيجه: كورنيش كوردون، برج الساعة وآثار أفسس القريبة. فنادق على الخليج.' },
  'كوالالمبور': { slug: 'kuala-lumpur', latin: 'KUALA LUMPUR', blurb: 'برجا بتروناس، كهوف باتو والأسواق والمراكز التجارية. فنادق في قلب العاصمة قرب كل شيء.' },
  'لنكاوي': { slug: 'langkawi', latin: 'LANGKAWI', blurb: 'جزر استوائية بشواطئ بيضاء، الجسر المعلّق والتلفريك فوق الغابة. منتجعات على البحر.' },
  'بينانغ': { slug: 'penang', latin: 'PENANG', blurb: 'جورج تاون التاريخية وفنّ الشوارع، أكلات الشارع الشهيرة وشواطئ باتو فرينغي.' },
  'مرتفعات جنتنج': { slug: 'genting', latin: 'GENTING', blurb: 'مدينة فوق السحاب بجوّ معتدل: تلفريك عبر الغابة، مدينة ملاهٍ ومزارع الفراولة.' },
  'ملاكا': { slug: 'malacca', latin: 'MALACCA', blurb: 'مدينة تاريخية على النهر: الساحة الحمراء، رحلات القوارب الليلية وسوق جونكر.' },
  'القاهرة': { slug: 'cairo', latin: 'CAIRO', blurb: 'الأهرامات وأبو الهول، المتحف المصري الكبير، الأزهر وخان الخليلي ورحلات النيل.' },
  'الإسكندرية': { slug: 'alexandria', latin: 'ALEXANDRIA', blurb: 'عروس المتوسط: الكورنيش، قلعة قايتباي ومكتبة الإسكندرية، ومطاعم السمك على البحر.' },
  'شرم الشيخ': { slug: 'sharm-el-sheikh', latin: 'SHARM EL SHEIKH', blurb: 'الشعاب المرجانية في البحر الأحمر، الغوص والسنوركلينغ، ومنتجعات شاملة كلياً على الشاطئ.' },
  'الغردقة': { slug: 'hurghada', latin: 'HURGHADA', blurb: 'شواطئ رملية ومياه فيروزية، رحلات الجزر والسفاري الصحراوي. منتجعات عائلية بأسعار مناسبة.' },
  'الأقصر': { slug: 'luxor', latin: 'LUXOR', blurb: 'أكبر متحف مفتوح في العالم: الكرنك، وادي الملوك ورحلات المنطاد فوق النيل.' },
  'أسوان': { slug: 'aswan', latin: 'ASWAN', blurb: 'النيل في أجمل صوره: الفلوكة، القرية النوبية، معبد فيلة ورحلة أبو سمبل.' },
  'تونس العاصمة': { slug: 'tunis', latin: 'TUNIS', blurb: 'المدينة العتيقة وجامع الزيتونة، سيدي بوسعيد بلونيه الأبيض والأزرق وآثار قرطاج.' },
  'الحمامات': { slug: 'hammamet', latin: 'HAMMAMET', blurb: 'شواطئ ذهبية ومدينة ياسمين الحمامات، منتجعات ومراكز علاج بمياه البحر.' },
  'سوسة': { slug: 'sousse', latin: 'SOUSSE', blurb: 'لؤلؤة الساحل: المدينة العتيقة، الرباط ومرسى القنطاوي، وفنادق على الشاطئ.' },
  'جربة': { slug: 'djerba', latin: 'DJERBA', blurb: 'جزيرة الأحلام: شواطئ هادئة، حومة السوق وجولات بين القرى التقليدية والنخيل.' },
  'المنستير': { slug: 'monastir', latin: 'MONASTIR', blurb: 'رباط المنستير على البحر، المارينا وشواطئ صافية، وقريبة من المطار.' },
  'طبرقة': { slug: 'tabarka', latin: 'TABARKA', blurb: 'غابات الفلّين والقلعة الجنوية، الغوص في المرجان وأجواء بحرية هادئة.' },
  'برشلونة': { slug: 'barcelona', latin: 'BARCELONA', blurb: 'كنيسة ساغرادا فاميليا، حديقة غويل، شارع لا رامبلا وشواطئ المدينة.' },
  'مدريد': { slug: 'madrid', latin: 'MADRID', blurb: 'القصر الملكي، متحف البرادو، ساحة مايور وحديقة ريتيرو. فنادق في قلب العاصمة.' },
  'غرناطة': { slug: 'granada', latin: 'GRANADA', blurb: 'قصر الحمراء وجنّة العريف وحيّ البيازين — آخر ممالك الأندلس.' },
  'إشبيلية': { slug: 'seville', latin: 'SEVILLA', blurb: 'الخيرالدا وقصر إشبيلية وساحة إسبانيا، والأحياء الأندلسية بأزهار البرتقال.' },
  'قرطبة': { slug: 'cordoba', latin: 'CÓRDOBA', blurb: 'جامع قرطبة الكبير والجسر الروماني على الوادي الكبير، وأزقّة الحيّ القديم.' },
  'ملقة': { slug: 'malaga', latin: 'MÁLAGA', blurb: 'شواطئ كوستا ديل سول، قلعة القصبة وجبل الفارو، ومدينة قديمة حيوية.' },
  'لندن': { slug: 'london', latin: 'LONDON', blurb: 'بيغ بن وعين لندن، قصر باكنغهام والمتحف البريطاني وشارع أكسفورد للتسوّق.' },
  'مانشستر': { slug: 'manchester', latin: 'MANCHESTER', blurb: 'ملاعب كرة القدم الشهيرة، الحيّ الشمالي والأسواق، ومدينة حيوية للطلبة والعائلات.' },
  'إدنبرة': { slug: 'edinburgh', latin: 'EDINBURGH', blurb: 'قلعة إدنبرة والميل الملكي والمدينة القديمة بطابعها الحجري الفريد.' },
  'أكسفورد': { slug: 'oxford', latin: 'OXFORD', blurb: 'كلّيات الجامعة العريقة، مكتبة بودليان والقنوات الهادئة — رحلة يوم من لندن.' },
  'الجزائر العاصمة': { slug: 'algiers', latin: 'ALGER', blurb: 'البهجة: القصبة ومقام الشهيد، حديقة التجارب والواجهة البحرية. فنادق في قلب المدينة وعلى البحر.' },
  'وهران': { slug: 'oran', latin: 'ORAN', blurb: 'الباهية: جبل المرجاجو وسانتا كروز، الواجهة البحرية وشواطئ الكورنيش الغربي.' },
  'قسنطينة': { slug: 'constantine', latin: 'CONSTANTINE', blurb: 'مدينة الجسور المعلّقة فوق وادي الرمال، قصر أحمد باي والمدينة القديمة.' },
  'الوادي': { slug: 'el-oued', latin: 'EL OUED', blurb: 'مدينة الألف قبّة: الكثبان الذهبية، غيطان النخيل وليالي الصحراء.' },
  'غرداية': { slug: 'ghardaia', latin: 'GHARDAÏA', blurb: 'وادي ميزاب المصنّف تراثاً عالمياً: القصور الخمسة والأسواق التقليدية.' },
  'جانت': { slug: 'djanet', latin: 'DJANET', blurb: 'بوابة الطاسيلي ناجر: صخور عملاقة ونقوش ما قبل التاريخ وكثبان تين مرزوقة.' },
  'تلمسان': { slug: 'tlemcen', latin: 'TLEMCEN', blurb: 'لؤلؤة المغرب: صومعة المنصورة، الجامع الكبير، هضبة لالة ستي وشلالات الوريط.' },
  'بجاية': { slug: 'bejaia', latin: 'BÉJAÏA', blurb: 'رأس كاربون والقمم الخضراء على البحر، يما قورايا وشواطئ الساحل الصافية.' },
};

const fallbackSlug = (name: string) => encodeURIComponent(name.trim().replace(/\s+/g, '-'));

export function cityInfo(name: string): CityInfo {
  return INFO[name] || { slug: fallbackSlug(name), latin: '', blurb: '' };
}

/** The city of a destination that a page address names ('' when none). */
export function cityFromSlug(cities: string[], slug: string): string {
  const s = decodeURIComponent(String(slug || '')).toLowerCase();
  return cities.find((c) => cityInfo(c).slug === s || decodeURIComponent(cityInfo(c).slug) === s || normAr(c) === normAr(s.replace(/-/g, ' '))) || '';
}

/** Whether a hotel's city fields name this city. */
export function hotelInCity(h: { city?: string; city_label?: string }, city: string): boolean {
  const c = normAr(city);
  return Boolean(c) && (normAr(h.city_label).includes(c) || normAr(h.city).includes(c));
}
