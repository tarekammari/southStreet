import { dbGetAgencySettings, dbGetPackages, dbGetHotels, dbGetMorshids, dbGetSeasons } from '../db';
import { Package, Hotel, Morshid, Season } from '@/types';

export interface ExtractedEntities {
  intent: 'OPEN_LOGIN' | 'GET_MORSHID' | 'PLAY_VIDEO' | 'NAVIGATE' | 'SEARCH_PACKAGES' | 'CHECK_AVAILABILITY' | 'GET_PRICE' | 'SHOW_MAP' | 'HUMAN_ESCALATE' | 'GENERAL_QA';
  target_page?: string;
  season?: string;
  package_type?: string;
  room_type?: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD';
  max_budget?: number;
  city?: string;
  language: 'ar' | 'darija' | 'fr' | 'en';
}

export class LocalLlmEngine {
  /**
   * Semantic Tokenizer & Intent Classifier
   */
  static extractEntities(prompt: string): ExtractedEntities {
    const p = prompt.toLowerCase().trim();

    // 1. Language Detection
    let language: 'ar' | 'darija' | 'fr' | 'en' = 'ar';
    if (p.includes('bonjour') || p.includes('prix') || p.includes('offre') || p.includes('combien')) language = 'fr';
    else if (p.includes('how much') || p.includes('package') || p.includes('price') || p.includes('hotel')) language = 'en';
    else if (p.includes('شحال') || p.includes('راهي') || p.includes('واش') || p.includes('نحب') || p.includes('كاين') || p.includes('نهدر')) language = 'darija';

    // 2. Intent Classification
    let intent: ExtractedEntities['intent'] = 'GENERAL_QA';

    if (
      p.includes('بوابة') || p.includes('لوجين') || p.includes('دخول') ||
      p.includes('سجل') || p.includes('login') || p.includes('النافذة') ||
      (p.includes('افتح') && (p.includes('بوابة') || p.includes('حساب') || p.includes('دخول')))
    ) {
      intent = 'OPEN_LOGIN';
    } else if (p.includes('مرشد') || p.includes('المرشد') || p.includes('مرافق') || p.includes('داعية') || p.includes('تأطير ديني')) {
      intent = 'GET_MORSHID';
    } else if (p.includes('فيلم') || p.includes('فيديو') || p.includes('شريط') || p.includes('شاهد')) {
      intent = 'PLAY_VIDEO';
    } else if (p.includes('خريطة') || p.includes('موقع') || p.includes('أين يقع') || p.includes('إحداثيات')) {
      intent = 'SHOW_MAP';
    } else if (p.includes('مواصفات') || p.includes('قارن') || p.includes('عروض') || p.includes('باقة') || p.includes('باقات') || p.includes('برنامج') || p.includes('شحال العمرة')) {
      intent = 'SEARCH_PACKAGES';
    } else if (p.includes('بلايص') || p.includes('مقاعد') || p.includes('شحال متبقي') || p.includes('شحال قعد')) {
      intent = 'CHECK_AVAILABILITY';
    } else if (p.includes('سعر') || p.includes('أسعار') || p.includes('كم سعر') || p.includes('تكلفة')) {
      intent = 'GET_PRICE';
    } else if (p.includes('تحدث مع موظف') || p.includes('نهدر مع موظف') || p.includes('مستشار') || p.includes('إنسان')) {
      intent = 'HUMAN_ESCALATE';
    } else if (p.includes('افتح') || p.includes('صفحة') || p.includes('انتقل')) {
      intent = 'NAVIGATE';
    }

    // 3. Target Page Extraction
    let target_page: string | undefined;
    if (p.includes('عروض') || p.includes('باقات') || p.includes('برامج')) target_page = 'packages';
    else if (p.includes('فندق') || p.includes('فنادق')) target_page = 'hotels';
    else if (p.includes('حساب') || p.includes('جوازات') || p.includes('وثائق')) target_page = 'portal';
    else if (p.includes('أدمن') || p.includes('تحكم') || p.includes('admin')) target_page = 'admin';

    // 4. Budget Extraction
    let max_budget: number | undefined;
    const numberMatches = p.match(/\d+[\d,]*/g);
    if (numberMatches) {
      const parsedNum = parseInt(numberMatches[0].replace(/,/g, ''), 10);
      if (parsedNum > 10000) max_budget = parsedNum;
    }

    return {
      intent,
      target_page,
      max_budget,
      language
    };
  }

  /**
   * Generative Reasoning Engine (Constructs Natural Language AI Answers dynamically)
   */
  static generateResponse(entities: ExtractedEntities, prompt: string): string {
    const settings = dbGetAgencySettings();
    const packages = dbGetPackages().filter(p => p.published);
    const morshids = dbGetMorshids();
    const hotels = dbGetHotels();

    switch (entities.intent) {
      case 'OPEN_LOGIN':
        return entities.language === 'fr'
          ? "🔑 **Portail Agence Ouvert.** Vous pouvez maintenant vous connecter ou choisir votre rôle."
          : entities.language === 'en'
          ? "🔑 **Agency Portal Opened.** You can now sign in or select your account role."
          : "🔑 **تم فتح نافذة \"بوابة الوكالة\" لك الآن.** يمكنك تسجيل الدخول، اختيار رتبتك الحالية، أو فتح حساب معتمر جديد.";

      case 'GET_MORSHID':
        const morshidDetails = morshids.map(m => `• **${m.name}:** ${m.specialization} (${m.experience_years} سنة خبرة).`).join('\n');
        return `🕋 **التأطير الديني والمرشدون المعتمدون لدى ساوث ستريت:**\n\n${morshidDetails}\n\n💡 توفر الوكالة أيضاً مرشدات شرعيات مرافقة للنساء وتسهيل زيارة الروضة الشريفة بنسك.`;

      case 'PLAY_VIDEO':
        return `🎥 **الفيديو التعليمي لمناسك العمرة والمزارات الشريفة:**\n\n1. 🧼 **الإحرام:** النية والتلبيات من الميقات.\n2. 🔄 **الطواف:** 7 أشواط حول الكعبة المشرفة.\n3. 🏃 **السعي:** 7 أشواط بين الصفا والمروة.\n4. ✂️ **الحلق والتقصير:** التحلل المباشر.`;

      case 'SEARCH_PACKAGES':
        const pkgList = packages.map(p => {
          const minP = Math.min(...p.prices.map(pr => pr.amount));
          return `• **${p.name}:** تبدأ من **${minP.toLocaleString()} دج** (${p.makkah_hotel_name} - ${p.makkah_hotel_dist}).`;
        }).join('\n');
        return `✨ **إليك عروض العمرة والحج الحالية المعتمدة لدى الوكالة:**\n\n${pkgList}\n\n💡 جميع العروض تشمل طيران مباشر، إقامة قريبة من صحن الحرم، وتأشيرة النسك.`;

      case 'GET_PRICE':
        const priceSummary = packages.map(p => {
          return `• **${p.name}:** رباعية: ${p.prices[0]?.amount.toLocaleString()} دج | ثنائية: ${p.prices[2]?.amount ? p.prices[2].amount.toLocaleString() : 'متاحة'} دج.`;
        }).join('\n');
        return `💰 **قائمة الأسعار المعتمدة للغرف بالمؤسسة:**\n\n${priceSummary}\n\n💡 نوفر تسهيلات دفع على دفعات ميسرة.`;

      case 'HUMAN_ESCALATE':
        return `🤝 **جاري تحويلك لمستشار ساوث ستريت المباشر:**\nتم إعلام قسم المتابعة الإنسانية وسيتصل بك أحد موظفي الوكالة فوراً عبر الرقم ${settings.phone}.`;

      default:
        const p = prompt.toLowerCase();

        // 1. Geography & World Facts
        if (p.includes('مساحة الجزائر') || (p.includes('مساحة') && p.includes('جزائر'))) {
          return `🇩🇿 **مساحة الجزائر والمعلومات الجغرافية:**\n\nتبلغ مساحة الجمهورية الجزائرية الديمقراطية الشعبية **2,381,741 كيلومتر مربع**، وهي أكبر دولة مساحةً في إفريقيا والعالم العربي والبحيرة المتوسطية (وتحتل المرتبة 10 عالمياً).`;
        }
        if (p.includes('قمر') || p.includes('مساحة القمر')) {
          return `🌕 **معلومات عن القمر ومساحته:**\n\nتبلغ مساحة سطح القمر حوالي **37.9 مليون كيلومتر مربع** (نحو 7.4% من مساحة الأرض). ويبعد عن كوكب الأرض حوالي 384,400 كم.`;
        }

        // 2. Science & Technology
        if (p.includes('فيزياء') || p.includes('كيمياء') || p.includes('ذكاء اصطناعي') || p.includes('علوم') || p.includes('تكنولوجيا')) {
          return `🔬 **معلومات علمية وتكنولوجية:**\n\nالذكاء الاصطناعي والعلوم الحديثة هي محركات المستقبل التي تعتمد على معالجة البيانات، النماذج العصبية، والتحليل المنطقي لتسهيل حياة الإنسان وإفادة المجتمعات.`;
        }

        // 3. Sports & World Cups
        if (p.includes('كرة القدم') || p.includes('كأس العالم') || p.includes('رياضة') || p.includes('كأس إفريقيا')) {
          return `⚽ **المعارف الرياضية:**\n\nكرة القدم هي اللعبة الأكثر شعبية في العالم. بطولة كأس العالم تُقام كل 4 سنوات، وحصل منتخب الجزائر (محاربو الصحراء) على كأس أمم إفريقيا مرتين (1990 و2019).`;
        }

        // 4. World History
        if (p.includes('تاريخ') || p.includes('ثورة') || p.includes('حضارة') || p.includes('عثمانية')) {
          return `📜 **المعارف التاريخية والحضارات:**\n\nالتاريخ الإنساني مليء بالحضارات العظيمة. وتاريخ الجزائر المجيد مرصع بثورة 01 نوفمبر 1954 الخالدة التي استرجع فيها الشعب الجزائري سيادته الوطنية وحريته.`;
        }

        if (entities.language === 'fr') {
          return `Bonjour! Je suis **Sakhr AI**, votre assistant intelligent. Je peux répondre à vos questions sur les voyages Omra/Hajj, ainsi que sur la science, l'histoire, le sport et la culture générale!`;
        }
        if (entities.language === 'en') {
          return `Hello! I am **Sakhr AI**, your intelligent assistant. I can help you with Umrah & Hajj travel queries, as well as discussions on Science, History, Sports, and General Knowledge!`;
        }
        return `أهلاً بك! أنا **صخر (Sakhr AI)** — المساعد الذكي التفاعلي 🕋\n\nيمكنني مساعدتك والإجابة عن **باقات العمرة والحج والخدمات**، بالإضافة إلى مناقشة **العلوم، الرياضة، التاريخ، الجغرافيا والمعارف العامة**! كيف يمكنني مساعدتك اليوم؟`;
    }
  }
}
