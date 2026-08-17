import { NextResponse } from 'next/server';
import { KnowledgeReader } from '@/lib/knowledge/knowledge-reader';
import { getDatabase, AiKnowledgeRule } from '@/lib/db';
import { AiCard, AiAction } from '@/types';

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SAKHR AI — ULTRA-FAST MULTI-TIER AGENT WITH REAL-TIME TOOLS & ACTIONS      │
 * │  Tier 0: Instant DB Taught Q&A Rules (0ms latency, taught by Admin/Guides) │
 * │  Tier 0.5: Web Page Live Scraper & Answering Tool                           │
 * │  Tier 0.8: Deep App Navigation & Morched Interactive Tools                  │
 * │  Tier 1: n8n Webhook Workflow (3.5s timeout fast-fail)                      │
 * │  Tier 2: Direct Gemini / OpenAI LLM (if configured)                         │
 * │  Tier 3: Local RAG Knowledge Engine & Smart Multi-modal Fallback            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// General Knowledge Base for instant answers
const GENERAL_KB: Record<string, string> = {
  'جبل': '🗻 **أعلى قمة جبلية في العالم** هي **قمة إيفرست** في سلسلة جبال الهيمالايا، ويصل ارتفاعها إلى حوالي **8,848 متراً** فوق سطح البحر. أما في الجزائر فأعلى قمة هي **قمة تاهات آتاكور** في الهقار بارتفاع 2,908 م.',
  'المانيا': '🇩🇪 **مساحة ألمانيا** الإجمالية تبلغ حوالي **357,588 كيلومتر مربع** (357,588 كم²). وعاصمتها برلين.',
  'ألمانيا': '🇩🇪 **مساحة ألمانيا** الإجمالية تبلغ حوالي **357,588 كيلومتر مربع** (357,588 كم²). وعاصمتها برلين.',
  'عاصمة': '🏛️ يمكنك الاستفسار عن عاصمة أو تفاصيل أي دولة، ويسعدني تزويدك بالمعلومات الجغرافية والخدمية فوراً.',
};

// Full verified team members and Murshidin dataset from About Us section and Agency Staff
const TEAM_MEMBERS_DATA = [
  {
    id: 'm1',
    name: 'الشيخ د. عبد الرحمن النوي',
    roleName: 'مرشد ديني أول — مكة المكرمة',
    specialization: 'دكتوراه في الفقه وأصوله. متفرغ لإلقاء الدروس التوجيهية وتوجيه ضيوف الرحمن في المناسك.',
    experience_years: 16,
    languages: ['العربية', 'الفرنسية'],
    phone: '+213 550 12 34 56',
    avatar: 'ع',
    rating: 4.98,
    status: 'متاح في مكة المكرمة',
    category: 'religious_guide',
    image: '/api/staff-image/morshed_01.png'
  },
  {
    id: 'm2',
    name: 'الشيخ محمد الطيب',
    roleName: 'مرشد المناسك والمزارات — المدينة المنورة',
    specialization: 'متخصص في الشروح التاريخية للمزارات بالمدينة المنورة ومرافقة الحجاج في الروضة الشريفة.',
    experience_years: 12,
    languages: ['العربية', 'الإنجليزية'],
    phone: '+213 551 98 76 54',
    avatar: 'م',
    rating: 4.95,
    status: 'في المدينة المنورة',
    category: 'religious_guide',
    image: '/api/staff-image/morshed_02.png'
  },
  {
    id: 'm3',
    name: 'الأستاذ فاروق بوزيد',
    roleName: 'مرشد ميداني وقائد مجموعات',
    specialization: 'يقود تفويج المجموعات في الحافلات والمطارات لضمان سلاسة حركة ضيوف الرحمن.',
    experience_years: 10,
    languages: ['العربية', 'الأمازيغية', 'الفرنسية'],
    phone: '+213 552 33 44 55',
    avatar: 'ف',
    rating: 4.9,
    status: 'مرافق الرحلات الميدانية',
    category: 'field_guide',
    image: '/api/staff-image/morshed_03.png'
  },
  {
    id: 'm4',
    name: 'الشيخ ياسين العلي',
    roleName: 'مرشد التوجيه الروحي والمتابعة',
    specialization: 'مختص بالتواصل الفوري والإجابة عن استفسارات وفتاوى المعتمرين والعائلات.',
    experience_years: 9,
    languages: ['العربية'],
    phone: '+213 553 66 77 88',
    avatar: 'ي',
    rating: 4.92,
    status: 'متاح للاستشارات والفتاوى',
    category: 'religious_guide',
    image: '/api/staff-image/morshed_04.png'
  },
  {
    id: 'f1',
    name: 'الأستاذة مريم',
    roleName: 'مرشدة شؤون النساء والمناسك',
    specialization: 'متخصصة في إرشاد الأخوات في أحكام الإحرام والزيارات النسائية بالروضة الشريفة.',
    experience_years: 8,
    languages: ['العربية', 'الفرنسية'],
    phone: '+213 554 11 22 33',
    avatar: 'م',
    rating: 4.99,
    status: 'متاحة للأخوات والمعتمرات',
    category: 'women_guide',
    image: '/api/staff-image/morshed_women_01.png'
  },
  {
    id: 'f2',
    name: 'الأستاذة عائشة الجزائري',
    roleName: 'مرشدة التوجيه ورعاية الأخوات',
    specialization: 'مرافقة المعتمرات في الصلوات والزيارات ومتابعة الخدمات الخاصة بالنساء وكبار السن.',
    experience_years: 7,
    languages: ['العربية', 'الأمازيغية'],
    phone: '+213 555 44 55 66',
    avatar: 'ع',
    rating: 4.93,
    status: 'متاحة لرعاية الأخوات',
    category: 'women_guide',
    image: '/api/staff-image/morshed_women_02.png'
  },
  {
    id: 's1',
    name: 'الأستاذ أحمد المنصوري',
    roleName: 'المدير العام لوكالة ساوث ستريت',
    specialization: 'يشرف على التعاقدات الفندقية والخطوط الجوية وضمان تطبيق أعلى معايير الجودة والراحة.',
    experience_years: 18,
    languages: ['العربية', 'الفرنسية', 'الإنجليزية'],
    phone: '+213 21 55 44 33',
    avatar: 'أ',
    rating: 5.0,
    status: 'إدارة الوكالة',
    category: 'staff',
    image: '/api/staff-image/director_agancy.png'
  },
  {
    id: 's2',
    name: 'السيد توفيق بوجمعة',
    roleName: 'مدير العمليات اللوجستية والنقل',
    specialization: 'مسؤول عن حجز الحافلات الحديثة VIP وتنسيق الرحلات الجوية ومواعيد الاستقبال.',
    experience_years: 14,
    languages: ['العربية', 'الفرنسية'],
    phone: '+213 556 77 88 99',
    avatar: 'ت',
    rating: 4.9,
    status: 'عمليات النقل واللوجستيك',
    category: 'staff',
    image: '/api/staff-image/team_member_01.png'
  },
  {
    id: 's3',
    name: 'الأستاذة سارة بن علي',
    roleName: 'مسؤولة التأشيرات وتنسيق الرحلات',
    specialization: 'تتولى إصدار التأشيرات الإلكترونية وتصاريح تطبيق نسك ودعم المعتمرين.',
    experience_years: 8,
    languages: ['العربية', 'الفرنسية', 'الإنجليزية'],
    phone: '+213 557 00 11 22',
    avatar: 'س',
    rating: 4.96,
    status: 'قسم التأشيرات وتصاريح نسك',
    category: 'staff',
    image: '/api/staff-image/team_member_06.png'
  },
  {
    id: 's4',
    name: 'السيد كريم يوسفي',
    roleName: 'منسق الإقامة والإعاشة الفندقية',
    specialization: 'مقيم بمكة والمدينة لمتابعة جودة الغرف والبوفيه المفتوح وتلبية كافة الطلبات الخاصة 24/7.',
    experience_years: 11,
    languages: ['العربية', 'الإنجليزية'],
    phone: '+213 558 33 22 11',
    avatar: 'ك',
    rating: 4.88,
    status: 'مقيم بمكة والمدينة 24/7',
    category: 'staff',
    image: '/api/staff-image/team_member_08.png'
  }
];

/**
 * Clean and extract readable text from HTML for Web tool
 */
function extractCleanTextFromHtml(html: string): { title: string; text: string } {
  let title = 'موقع إلكتروني';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/\s+/g, ' ').trim();
  }

  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  clean = clean.substring(0, 1800);
  return { title, text: clean };
}

/**
 * Fetch and summarize webpage live in real time
 */
async function fetchWebPageTool(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0 (Sakhr AI Agent)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const { title, text } = extractCleanTextFromHtml(html);
    if (!text || text.length < 20) return null;

    return {
      title,
      text: text.substring(0, 800),
      url
    };
  } catch {
    return null;
  }
}

/**
 * Detect Navigation Intent and Deep App Pages
 */
function detectNavigationIntent(prompt: string): { action?: AiAction; actionCard?: AiCard; text?: string } | null {
  const lower = prompt.toLowerCase();

  if (['افتح الباقات', 'صفحة الباقات', 'خذني للباقات', 'عرض الباقات', 'اريد حجز باقة', 'باقات العمرة'].some(k => lower.includes(k))) {
    return {
      text: '🚀 تم توجيهك إلى **صفحة باقات العمرة 2026**. يمكنك استعراض كافة البرامج والأسعار وتفاصيل الفنادق المتاحة.',
      action: { type: 'navigate', target: 'packages' },
      actionCard: {
        type: 'action',
        data: {
          title: 'صفحة باقات العمرة 2026',
          description: 'استعراض باقة أوت وباقة المولد النبوي VIP مع تفاصيل الأسعار والحجوزات.',
          buttonText: '🚀 الانتقال إلى صفحة الباقات الآن',
          targetUrl: '/packages'
        }
      }
    };
  }

  if (['افتح الفنادق', 'صفحة الفنادق', 'فنادق مكة', 'فنادق المدينة', 'سويس اوتيل', 'منارات غزة'].some(k => lower.includes(k))) {
    return {
      text: '🏨 تم توجيهك إلى **دليل فنادق مكة المكرمة والمدينة المنورة**. ستجد صور ومسافات الفنادق المعتمدة مع الوكالة.',
      action: { type: 'navigate', target: 'hotels' },
      actionCard: {
        type: 'action',
        data: {
          title: 'دليل فنادق الحرمين',
          description: 'فندق سويس أوتيل برج الساعة، منارات غزة، وفنادق المدينة المنورة القريبة.',
          buttonText: '🏨 تصفح الفنادق الآن',
          targetUrl: '/hotels'
        }
      }
    };
  }

  if (['افتح المناسك', 'عداد الطواف', 'دليل المناسك', 'خطوات العمرة', 'عداد السعي'].some(k => lower.includes(k))) {
    return {
      text: '🕋 تفضل بفتح **عداد ودليل المناسك التفاعلي** لمتابعة أشواط الطواف والسعي وتلاوة الأدعية المأثورة.',
      action: { type: 'navigate', target: 'portal?tab=rituals' },
      actionCard: {
        type: 'action',
        data: {
          title: 'عداد ودليل المناسك التفاعلي',
          description: 'متابعة أشواط الطواف (7 أشواط) والسعي، مع نصوص الأدعية والتوجيه الصوتي.',
          buttonText: '🕋 فتح عداد المناسك الآن',
          targetUrl: '/portal?tab=rituals'
        }
      }
    };
  }

  if (['افتح المحادثة', 'الشات', 'تواصل مع الفوج', 'غرفة المحادثة', 'شات المرشد'].some(k => lower.includes(k))) {
    return {
      text: '💬 يمكنك فتح **غرفة المحادثة الميدانية** للتواصل المباشر مع المرشد الديني ومسير الفوج وباقي المعتمرين.',
      action: { type: 'navigate', target: 'portal?tab=chat' },
      actionCard: {
        type: 'action',
        data: {
          title: 'غرفة المحادثة والتواصل الفوري',
          description: 'مراسلة الشيخ د. عبد الرحمن النوي ومسير الفوج والتنبيهات المباشرة المشفرة.',
          buttonText: '💬 فتح الشات الآن',
          targetUrl: '/portal?tab=chat'
        }
      }
    };
  }

  if (['لوحة الادارة', 'لوحة المدير', 'لوحة الإدارة', 'صفحة الادمن', 'admin dashboard'].some(k => lower.includes(k))) {
    return {
      text: '🛡️ تم فتح رابط **لوحة الإدارة والتحكم الأمنية (Super Admin)** لإدارة الحسابات وتدريب صخر AI ومتابعة الجلسات.',
      action: { type: 'navigate', target: 'admin' },
      actionCard: {
        type: 'action',
        data: {
          title: 'لوحة الإدارة والتحكم (Admin)',
          description: 'إدارة أمان الوكالة، تدريب صخر الذكي، توليد الحسابات ومفاتيح الأمان.',
          buttonText: '🛡️ الدخول للوحة الإدارة',
          targetUrl: '/admin'
        }
      }
    };
  }

  if (['تسجيل الدخول', 'تسجيل دخول', 'دخول الحساب', 'تسجيل حساب'].some(k => lower.includes(k))) {
    return {
      text: '🔐 جاري فتح **نافذة تسجيل الدخول** الخاصة بوكالة ساوث ستريت...',
      action: { type: 'open_modal', target: 'login' },
      actionCard: {
        type: 'action',
        data: {
          title: 'تسجيل الدخول للنظام',
          description: 'تسجيل دخول الإدارة، المرشد، المحاسب أو المعتمر المعتمد.',
          buttonText: '🔑 فتح نافذة الدخول',
          targetModal: 'login'
        }
      }
    };
  }

  if (['بوابة المعتمر', 'حسابي', 'لوحة التحكم', 'الملف الشخصي', 'حجوزاتي', 'سنداتي'].some(k => lower.includes(k))) {
    return {
      text: '👤 تفضل بزيارة **بوابة المستخدمين والمعتمرين (Portal)** لمتابعة حجوزاتك، وثائقك وسندات القبض.',
      action: { type: 'navigate', target: 'portal' },
      actionCard: {
        type: 'action',
        data: {
          title: 'بوابة المعتمرين والكوادر (Portal)',
          description: 'لوحة تحكم تفاعلية للمعتمر، المرشد، والمحاسب.',
          buttonText: '👤 فتح لوحة التحكم',
          targetUrl: '/portal'
        }
      }
    };
  }

  return null;
}

/**
 * Check if the user is asking about Morched / Guides / Staff from About Us
 */
function detectMorchedIntent(prompt: string): { text: string; cards: AiCard[] } | null {
  const lower = prompt.toLowerCase();
  
  // Keyword groups
  const isMurshidQuery = ['مرشد', 'مرشدين', 'mourshid', 'morshid', 'mourshdin', 'morched', 'guides', 'guide', 'شيخ', 'شيوخ', 'مرافقة دينية', 'مرافق', 'فقه'].some(k => lower.includes(k));
  const isStaffQuery = ['طاقم', 'فريق', 'الاعضاء', 'الأعضاء', 'الادارة', 'الإدارة', 'about us', 'من نحن', 'staff', 'team', 'members', 'مسؤولين', 'مسيرين'].some(k => lower.includes(k));
  const isWomenQuery = ['نساء', 'النساء', 'مرشدة', 'مرشدات', 'سيدات', 'أخوات', 'اخوات', 'women', 'female'].some(k => lower.includes(k));
  
  // Specific name checks
  const isEnnaoui = lower.includes('عبد الرحمن') || lower.includes('عبدالرحمن') || lower.includes('النوي') || lower.includes('ennaoui');
  const isTayeb = lower.includes('الطيب') || lower.includes('محمد الطيب') || lower.includes('tayeb');
  const isFarouk = lower.includes('فاروق') || lower.includes('بوزيد') || lower.includes('bouzid');
  const isYacine = lower.includes('ياسين') || lower.includes('العلي') || lower.includes('yacine');
  const isMeriem = lower.includes('مريم') || lower.includes('meriem') || lower.includes('meryem');
  const isAicha = lower.includes('عائشة') || lower.includes('عائشه') || lower.includes('aicha');
  const isMansouri = lower.includes('المنصوري') || lower.includes('احمد المنصوري') || lower.includes('أحمد المنصوري') || lower.includes('المدير العام');
  const isBoudjemaa = lower.includes('توفيق') || lower.includes('بوجمعة') || lower.includes('boudjemaa') || lower.includes('نقل') || lower.includes('حافلات');
  const isSara = lower.includes('سارة') || lower.includes('ساره') || lower.includes('تأشيرات') || lower.includes('تاشيرات') || lower.includes('نسك');
  const isKareem = lower.includes('كريم') || lower.includes('يوسفي') || lower.includes('فندقية') || lower.includes('إعاشة') || lower.includes('اعاشة');

  const hasSpecificName = isEnnaoui || isTayeb || isFarouk || isYacine || isMeriem || isAicha || isMansouri || isBoudjemaa || isSara || isKareem;

  if (isMurshidQuery || isStaffQuery || isWomenQuery || hasSpecificName) {
    let matchedMembers = TEAM_MEMBERS_DATA;

    if (hasSpecificName) {
      matchedMembers = TEAM_MEMBERS_DATA.filter(m => {
        if (isEnnaoui && m.name.includes('عبد الرحمن')) return true;
        if (isTayeb && m.name.includes('الطيب')) return true;
        if (isFarouk && m.name.includes('فاروق')) return true;
        if (isYacine && m.name.includes('ياسين')) return true;
        if (isMeriem && m.name.includes('مريم')) return true;
        if (isAicha && m.name.includes('عائشة')) return true;
        if (isMansouri && m.name.includes('المنصوري')) return true;
        if (isBoudjemaa && m.name.includes('توفيق')) return true;
        if (isSara && m.name.includes('سارة')) return true;
        if (isKareem && m.name.includes('كريم')) return true;
        return false;
      });
    } else if (isWomenQuery) {
      matchedMembers = TEAM_MEMBERS_DATA.filter(m => m.category === 'women_guide');
    } else if (isStaffQuery && !isMurshidQuery) {
      matchedMembers = TEAM_MEMBERS_DATA.filter(m => m.category === 'staff');
    } else if (isMurshidQuery) {
      matchedMembers = TEAM_MEMBERS_DATA.filter(m => m.category === 'religious_guide' || m.category === 'women_guide' || m.category === 'field_guide');
    }

    if (matchedMembers.length === 0) {
      matchedMembers = TEAM_MEMBERS_DATA;
    }

    const cards: AiCard[] = matchedMembers.map(member => ({
      type: 'morshid',
      data: member
    }));

    let introText = `✨ **طاقم وكالة ساوث ستريت والمرشدون الميدانيون المعتمدون (About Us):**\n\n`;
    if (isWomenQuery) {
      introText = `🧕 **المرشدات الدينيات لشؤون الأخوات والنساء بوكالة ساوث ستريت:**\n\nتتولى المرشدات مرافقة الأخوات المعتمرات في الصلوات والزيارات بالروضة الشريفة وأحكام الإحرام:\n\n`;
    } else if (hasSpecificName && matchedMembers.length === 1) {
      introText = `👤 **بطاقة التواصل الرسمية مع ${matchedMembers[0].name}:**\n\n`;
    } else if (isStaffQuery) {
      introText = `🏢 **فريق الإدارة والعمليات اللوجستية بوكالة ساوث ستريت:**\n\nنخبة متخصصة للإشراف على الفنادق، التأشيرات، الطيران والنقل:\n\n`;
    }

    return {
      text: `${introText}👇 يمكنك الاتصال المباشر 📞 أو فتح محادثة فورية 💬 مع أي عضو من الفريق أدناه:`,
      cards
    };
  }

  return null;
}

/**
 * Detect Packages & Offers Intent
 */
function detectPackageOfferIntent(prompt: string): { text: string; cards: AiCard[] } | null {
  const lower = prompt.toLowerCase();
  const offerKeywords = ['عروض', 'عرض', 'offers', 'offer', 'باقات', 'باقة', 'packages', 'package', 'اسعار', 'أسعار', 'تخفيض', 'تخفيضات', 'سعر العمرة', 'تكلفة العمرة', 'رحلات', 'برامج'];

  if (offerKeywords.some(k => lower.includes(k))) {
    try {
      const db = getDatabase();
      const packages = db.packages && db.packages.length > 0 ? db.packages : [];

      const cards: AiCard[] = packages.map(pkg => ({
        type: 'package',
        data: {
          id: pkg.package_id,
          name: pkg.name,
          type: pkg.type === 'VIP' ? 'عمرة VIP' : 'عمرة اقتصادية',
          makkah_hotel_name: pkg.makkah_hotel_name,
          makkah_hotel_dist: pkg.makkah_hotel_dist,
          airline: pkg.airline,
          duration_days: pkg.duration_days,
          available: pkg.available,
          description: pkg.description,
          prices: pkg.prices.map(p => ({
            room_type: p.room_type === 'QUAD' ? 'رباعية' : p.room_type === 'TRIPLE' ? 'ثلاثية' : p.room_type === 'DOUBLE' ? 'ثنائية' : 'فردية',
            amount: p.amount,
            currency: 'دج'
          }))
        }
      }));

      return {
        text: `🕋 **عروض وباقات العمرة والحج 2026 الحالية بوكالة ساوث ستريت:**\n\nتفضل باستعراض تفاصيل البرامج المتاحة، الفنادق، والأسعار المعتمدة مع إمكانية الحجز المباشر:`,
        cards
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Search Dynamic DB Taught AI Knowledge Base (Tier 0 Fast Check)
 */
function searchDynamicDbKnowledge(prompt: string): { rule: AiKnowledgeRule; score: number } | null {
  try {
    const db = getDatabase();
    if (!db.aiKnowledge || db.aiKnowledge.length === 0) return null;

    const lower = prompt.toLowerCase().trim();
    let bestRule: AiKnowledgeRule | null = null;
    let maxScore = 0;

    for (const rule of db.aiKnowledge) {
      if (!rule.is_active) continue;

      let score = 0;
      // Keyword matching
      for (const kw of rule.keywords) {
        const cleanKw = (kw || '').toLowerCase().trim();
        if (cleanKw && lower.includes(cleanKw)) {
          score += 10 + cleanKw.length;
        }
      }

      // Title matching
      const titleWords = rule.title_ar.toLowerCase().split(' ').filter(w => w.length > 2);
      for (const tw of titleWords) {
        if (lower.includes(tw)) {
          score += 8;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestRule = rule;
      }
    }

    if (bestRule && maxScore >= 10) {
      return { rule: bestRule, score: maxScore };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Built-in fallback AI generator using local knowledge base
 */
async function generateLocalRagResponse(prompt: string) {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Greetings
  if (['مرحبا', 'مرحباً', 'سلام', 'السلام عليكم', 'أهلا', 'اهلا', 'صباح الخير', 'مساء الخير', 'hi', 'hello'].some(g => lower.includes(g))) {
    return {
      text: `أهلاً وسهلاً بك في وكالة **ساوث ستريت** للسياحة والأسفار والحج والعمرة 🕋✨\n\nأنا **صخر**، مساعدك الذكي فائق السرعة. كيف يمكنني خدمتك اليوم؟\n- 💰 **الاستفسار عن أسعار وباقات العمرة 2026**\n- 🧭 **طلب التواصل مع المرشد الديني أو تصفح المرشدين**\n- ✈️ **الانتقال لصفحات التطبيق (الباقات، الفنادق، المناسك، السندات)**\n- 🌐 **البحث واستخراج الإجابات من صفحات الويب**`,
      cards: []
    };
  }

  // 2. Check general knowledge dictionary
  for (const [key, answer] of Object.entries(GENERAL_KB)) {
    if (lower.includes(key)) {
      return {
        text: answer,
        cards: []
      };
    }
  }

  // 3. Search local Knowledge Base files
  const searchResult = await KnowledgeReader.search(cleanPrompt, 3);

  if (searchResult && searchResult.chunks.length > 0 && searchResult.chunks[0].score > 0) {
    const topChunks = searchResult.chunks;
    let responseText = `🕋 **معلومات وكالة ساوث ستريت الرسمية:**\n\n`;

    topChunks.forEach((chunk) => {
      responseText += `📌 **${chunk.heading}**\n${chunk.content}\n\n`;
    });

    const cards: AiCard[] = [];
    if (lower.includes('مولد') || lower.includes('mawlid')) {
      cards.push({
        type: 'package',
        data: {
          id: 'pkg-mawlid-2026',
          name: 'باقة المولد النبوي VIP 2026',
          type: 'عمرة VIP',
          makkah_hotel_name: 'سويس أوتيل برج الساعة',
          makkah_hotel_dist: '50م مباشر من الحرم',
          airline: 'الخطوط السعودية VIP',
          duration_days: 15,
          available: 9,
          description: 'إقامة فاخرة ببرج الساعة مع إطلالة وبوفيه مفتوح واستقبال VIP.',
          prices: [
            { room_type: 'رباعية', amount: 295000, currency: 'دج' },
            { room_type: 'ثلاثية', amount: 325000, currency: 'دج' },
            { room_type: 'ثنائية', amount: 375000, currency: 'دج' }
          ]
        }
      });
    } else if (lower.includes('أوت') || lower.includes('اوت') || lower.includes('اقتصادية') || lower.includes('سعر') || lower.includes('أسعار') || lower.includes('عمرة')) {
      cards.push({
        type: 'package',
        data: {
          id: 'pkg-aug-2026',
          name: 'باقة أوت الاقتصادية المميزة 2026',
          type: 'عمرة اقتصادية',
          makkah_hotel_name: 'منارات غزة',
          makkah_hotel_dist: '350م عن الحرم',
          airline: 'الخطوط الجوية الجزائرية',
          duration_days: 15,
          available: 17,
          description: 'رحلة مباشرة مع مرافقة دينية وصحية وتسهيلات بالدفع.',
          prices: [
            { room_type: 'رباعية', amount: 215000, currency: 'دج' },
            { room_type: 'ثلاثية', amount: 235000, currency: 'دج' },
            { room_type: 'ثنائية', amount: 265000, currency: 'دج' }
          ]
        }
      });
    }

    return {
      text: responseText.trim(),
      cards
    };
  }

  // 4. Default helpful answer
  return {
    text: `شكراً لتواصلك مع **ساوث ستريت** 🕋\n\nبخصوص استفسارك عن: **"${cleanPrompt}"**\nيسعدنا تزويدك بكافة تفاصيل رحلات العمرة والحج لعام 2026 مع نخبة من المرشدين المعتمدين وفنادق بجوار الحرمين الشريفين.\n\n📞 للتواصل المباشر مع فريق الوكالة: **+213 550 12 34 56**`,
    cards: []
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = (body.prompt || '').trim();
    const history = body.history || [];
    const sessionId = body.sessionId || 'default-session';

    if (!prompt) {
      return NextResponse.json({
        text: 'يرجى كتابة سؤالك وسيجيبك صخر فوراً. 🕋'
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 1: Deep App Navigation Intent (Instant Action)
    // ─────────────────────────────────────────────────────────────
    const navResult = detectNavigationIntent(prompt);
    if (navResult) {
      return NextResponse.json({
        text: navResult.text,
        actions: navResult.action ? [navResult.action] : [],
        cards: navResult.actionCard ? [navResult.actionCard] : []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 2: Morched (Guide) Discovery & Interactive Cards
    // ─────────────────────────────────────────────────────────────
    const morchedResult = detectMorchedIntent(prompt);
    if (morchedResult) {
      return NextResponse.json({
        text: morchedResult.text,
        cards: morchedResult.cards,
        actions: []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 2.5: Live Packages & Offers Tool
    // ─────────────────────────────────────────────────────────────
    const packageResult = detectPackageOfferIntent(prompt);
    if (packageResult) {
      return NextResponse.json({
        text: packageResult.text,
        cards: packageResult.cards,
        actions: []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 3: Live Web Page Scraper & Reader Tool (if URL provided)
    // ─────────────────────────────────────────────────────────────
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
    if (urlMatch && urlMatch[0]) {
      const targetUrl = urlMatch[0];
      const webResult = await fetchWebPageTool(targetUrl);
      if (webResult) {
        return NextResponse.json({
          text: `🌐 **قراءة مباشرة من الموقع:** [${webResult.title}](${webResult.url})\n\n${webResult.text}\n\n💡 *تم استخراج وتلخيص الإجابة مباشرة من الرابط المطلوب بواسطة أداة الويب لصخر.*`,
          cards: [],
          actions: []
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 0: Instant DB Taught Q&A Rules (Sub-millisecond latency!)
    // ─────────────────────────────────────────────────────────────
    const dbMatch = searchDynamicDbKnowledge(prompt);
    if (dbMatch) {
      const rule = dbMatch.rule;
      const cards: AiCard[] = [];
      const actions: AiAction[] = [];

      // Auto-attach appropriate action/card if relevant
      if (rule.category === 'packages') {
        cards.push({
          type: 'action',
          data: {
            title: rule.title_ar,
            description: 'استعراض الحجز المباشر لهذه الباقة',
            buttonText: '🚀 الانتقال لصفحة الباقات',
            targetUrl: '/packages'
          }
        });
      } else if (rule.category === 'rituals') {
        cards.push({
          type: 'action',
          data: {
            title: 'دليل ومناسك العمرة',
            description: 'فتح عداد الطواف والأدعية التفاعلية',
            buttonText: '🕋 فتح عداد المناسك',
            targetUrl: '/portal?tab=rituals'
          }
        });
      } else if (rule.category === 'pricing') {
        cards.push({
          type: 'action',
          data: {
            title: 'المدفوعات وسندات القبض',
            description: 'عرض السندات وطرق الدفع عبر بريدي موب / CCP',
            buttonText: '💳 عرض السندات والتحويلات',
            targetUrl: '/portal?tab=payments'
          }
        });
      }

      return NextResponse.json({
        text: rule.response_ar,
        cards,
        actions
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 1: n8n Webhook Workflow (Snappy 3.5s timeout)
    // ─────────────────────────────────────────────────────────────
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl && n8nWebhookUrl.startsWith('http') && !n8nWebhookUrl.includes('your-n8n-domain.com')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            message: prompt,
            history,
            sessionId,
            timestamp: new Date().toISOString()
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const text = data.text || data.output || data.response || (typeof data === 'string' ? data : '');
          if (text && text.trim().length > 0) {
            return NextResponse.json({
              text,
              cards: data.cards || [],
              actions: data.actions || [],
              media: data.media || []
            });
          }
        }
      } catch (err: any) {
        console.warn('[n8n Webhook] Fast fallback triggered:', err?.message);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: Google Gemini Direct LLM with Knowledge Context
    // ─────────────────────────────────────────────────────────────
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.SAKHR_GEMINI_KEY;
    if (geminiApiKey) {
      try {
        const kbResults = await KnowledgeReader.search(prompt, 3);
        const kbContext = kbResults.chunks.map(c => `[${c.heading}]: ${c.content}`).join('\n\n');

        const systemInstruction = `أنت صخر، المساعد الذكي لوكالة ساوث ستريت (South Street) للأسفار والحج والعمرة بالجزائر.
أجب بلباقة ولغة عربية راقية وموثوقة. استخدم بيانات الوكالة للإجابة بدقة، وأجب على الأسئلة العامة بدقة وإيجاز.
بيانات الوكالة المتوفرة:
${kbContext}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${systemInstruction}\n\nسؤال المستخدم: ${prompt}` }
                  ]
                }
              ]
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            return NextResponse.json({
              text: replyText,
              cards: []
            });
          }
        }
      } catch (geminiErr: any) {
        console.warn('[Gemini API] Failed, falling back to local engine:', geminiErr?.message);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 3: Local RAG Knowledge Engine & Smart NLP Fallback
    // ─────────────────────────────────────────────────────────────
    const localResult = await generateLocalRagResponse(prompt);
    return NextResponse.json(localResult);

  } catch (error: any) {
    console.error('[Sakhr Route Error]:', error?.message);
    return NextResponse.json(
      { error: 'حدث خطأ في معالجة طلب الذكاء الاصطناعي' },
      { status: 500 }
    );
  }
}
