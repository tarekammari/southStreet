import { AiCard, AiAction } from '@/types';
import { getDatabase, saveDatabase, AiKnowledgeRule } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';
import {
  toolSearchPackages,
  toolGetSeasonsInfo,
  toolGetAgencySettings,
  toolGetTeamMembers,
  toolGetHotelsInfo,
  toolSearchKnowledge,
  toolComparePackages,
  toolSearchAppContent,
  toolResolveNavigation,
  toolGetSiteInventory,
  toolGetSitemapContext,
} from '@/lib/ai-tools';
import { runTrustedToolPipeline, hasArabicKeyword, isFactualQuestion } from '@/lib/sakhr-trusted-tools';
import { callExternalAI } from '@/lib/sakhr-external-ai';
import {
  AGENCY_SOURCE_LABELS,
  getAgencySourceLabel,
  GENERAL_KB,
  extractCleanTextFromHtml,
  fetchWebPageTool,
} from './sakhrShared';
import {
  formatPackagesAnswer,
  formatHotelsAnswer,
  buildClarifyingFallback,
  sanitizeSakhrReply,
  looksLikePriceQuestion,
  buildUnknownPriceResponse,
} from '@/lib/sakhr-smart';
import { KnowledgeReader } from '@/lib/knowledge/knowledge-reader';

export function detectSiteInventoryIntent(prompt: string): { text: string; cards: AiCard[]; actions: AiAction[] } | null {
  const lower = prompt.toLowerCase();
  const isInventoryQuery = [
    'ما هي الصفحات', 'ما الصفحات', 'عرض الصفحات', 'صفحات التطبيق', 'أقسام التطبيق',
    'ما الأقسام', 'ما هي الأقسام', 'عرض الأقسام', 'خريطة الموقع', 'sitemap',
    'ماذا يمكنك أن تفتح', 'ماذا يمكنك فتح', 'ما الذي يمكنك', 'عناصر التطبيق',
    'محتوى التطبيق', 'what pages', 'show sections', 'list pages', 'site map',
    'ماذا يوجد في', 'ما يوجد في التطبيق', 'استكشف التطبيق', 'دليل التطبيق',
  ].some(k => lower.includes(k));

  if (!isInventoryQuery) return null;

  const inventory = toolGetSiteInventory();
  const cards: AiCard[] = inventory.flatMap(page => {
    const pageCard: AiCard = {
      type: 'action',
      data: {
        title: page.title,
        description: page.description,
        buttonText: `📂 فتح ${page.title}`,
        targetUrl: page.path,
      },
    };
    const sectionCards: AiCard[] = (page.sections || []).map(sec => ({
      type: 'action',
      data: {
        title: sec.title,
        description: sec.description,
        buttonText: `↗ ${sec.title}`,
        targetUrl: sec.target,
      },
    }));
    return [pageCard, ...sectionCards];
  });

  let text = `🗺️ **خريطة تطبيق وكالة ساوث ستريت — ${inventory.length} صفحات رئيسية:**\n\n`;
  inventory.forEach(page => {
    text += `📄 **${page.title}** (${page.path})\n${page.description}\n`;
    (page.sections || []).forEach(sec => {
      text += `  • ${sec.title}: ${sec.description}\n`;
    });
    text += '\n';
  });
  text += `\n💡 **يمكنك طلب فتح أي صفحة أو قسم** — مثال: "افتح قسم المرشدين" أو "خذني لصفحة الفنادق"`;

  return { text: text.trim(), cards: cards.slice(0, 12), actions: [] };
}

/**
 * Smart sitemap-based navigation — resolves natural language to any page/section
 */
export function detectSmartNavigationIntent(prompt: string): { text?: string; action?: AiAction; actionCard?: AiCard } | null {
  const lower = prompt.toLowerCase();
  const navVerbs = ['افتح', 'اذهب', 'خذني', 'انتقل', 'عرض', 'أريد', 'ودني', 'روح', 'navigate', 'open', 'go to', 'show me'];
  const hasNavIntent = navVerbs.some(v => lower.includes(v));
  if (!hasNavIntent) return null;

  const target = toolResolveNavigation(prompt);
  if (!target || !target.path) return null;

  const path = target.path.startsWith('/') ? target.path.slice(1) : target.path;
  const isHash = path.includes('#');
  const actionTarget = isHash ? path.split('#')[1] ? `#${path.split('#')[1]}` : path : path;

  return {
    text: `✅ **تم تحديد وجهتك:** ${target.label}\n\n${target.description}\n\nجاري فتحها الآن...`,
    action: { type: 'navigate', target: actionTarget.startsWith('#') ? actionTarget : path },
    actionCard: {
      type: 'action',
      data: {
        title: target.label,
        description: target.description,
        buttonText: `↗ الانتقال إلى ${target.label}`,
        targetUrl: target.path.startsWith('/') ? target.path : `/${target.path}`,
      },
    },
  };
}

/**
 * TOOL: Hotel discovery from SQLite
 */
export function detectHotelIntent(prompt: string): { text: string; cards: AiCard[] } | null {
  if (!hasArabicKeyword(prompt, ['فندق', 'فنادق', 'hotel', 'hotels', 'إقامة', 'مكة', 'مكه', 'المدينة', 'سويس', 'منارات', 'الحرم'])) {
    return null;
  }
  if (isFactualQuestion(prompt)) return null;

  let city: string | undefined;
  if (hasArabicKeyword(prompt, ['مكة', 'makkah'])) city = 'MAKKAH';
  if (hasArabicKeyword(prompt, ['المدينة', 'madinah'])) city = 'MADINAH';

  const hotels = toolGetHotelsInfo(city);
  if (!hotels.length) return null;

  const cards: AiCard[] = hotels.map(h => ({
    type: 'hotel',
    data: {
      hotel_id: h.hotel_id,
      name: h.name,
      city: h.city,
      distance_from_haram: h.distance_from_haram,
      description: h.description,
      services: h.services,
      images: h.images,
    },
  }));

  return {
    text: sanitizeSakhrReply(formatHotelsAnswer(hotels, `🏨 **فنادقنا المعتمدة (${hotels.length})** — قرب الحرمين الشريفين`)),
    cards,
  };
}

/**
 * TOOL: Package comparison
 */
export function detectCompareIntent(prompt: string): { text: string; cards: AiCard[] } | null {
  const lower = prompt.toLowerCase();
  if (!['قارن', 'مقارنة', 'compare', 'فرق بين', 'الفرق بين'].some(k => lower.includes(k))) return null;

  const packages = toolSearchPackages();
  if (packages.length < 2) return null;

  const toCompare = packages.slice(0, 3);
  const comparisonData = toolComparePackages(toCompare.map(p => p.package_id));

  return {
    text: sanitizeSakhrReply(
      '⚖️ **مقارنة الباقات المعتمدة**\n\n' +
      formatPackagesAnswer(
        comparisonData.map(p => ({
          name: p.name,
          duration_days: p.duration_days,
          makkah_hotel_name: p.makkah_hotel_name,
          prices: p.prices,
        })),
        ''
      ).replace(/^📦[^\n]*\n\n/, '')
    ),
    cards: [{ type: 'comparison', data: comparisonData }],
  };
}

export function detectNavigationIntent(prompt: string): { action?: AiAction; actionCard?: AiCard; text?: string } | null {
  const lower = prompt.toLowerCase();

  if (['الرئيسية', 'الصفحة الرئيسية', 'افتح الرئيسية', 'خذني للرئيسية', 'الرئيسيه'].some(k => lower.includes(k))) {
    return {
      text: '🏠 تم توجيهك إلى **الصفحة الرئيسية** لوكالة ساوث ستريت.',
      action: { type: 'navigate', target: '' },
      actionCard: {
        type: 'action',
        data: {
          title: 'الصفحة الرئيسية',
          description: 'الواجهة الرئيسية، حاسبة العمرة، عروض البرامج والأسعار.',
          buttonText: '🏠 الانتقال للرئيسية',
          targetUrl: '/'
        }
      }
    };
  }

  if (['عن الوكالة', 'عن وكالة', 'من نحن', 'تعريف الوكالة', 'about us'].some(k => lower.includes(k))) {
    return {
      text: '🏢 تم توجيهك إلى قسم **عن الوكالة** للتعرف على خبرة ساوث ستريت في رحلات العمرة والحج المباشرة.',
      action: { type: 'navigate', target: '#about-section' },
      actionCard: {
        type: 'action',
        data: {
          title: 'عن وكالة ساوث ستريت',
          description: 'خبرة أكثر من 15 عاماً في تأطير ضيوف الرحمن والتأشيرات المباشرة.',
          buttonText: '🏢 الانتقال لقسم عن الوكالة',
          targetUrl: '/#about-section'
        }
      }
    };
  }

  if (['البرامج', 'صفحة البرامج', 'برامج العمرة', 'عروض البرامج'].some(k => lower.includes(k))) {
    return {
      text: '📋 البرامج والباقات صفحة واحدة. هنا التاريخ، الفندق، السعر، والمقاعد.',
      action: { type: 'navigate', target: 'packages' },
      actionCard: {
        type: 'action',
        data: {
          title: 'برامج العمرة والحج',
          description: 'التاريخ، الفندق، السعر، والمقاعد في كتالوج واحد.',
          buttonText: '📋 تصفح البرامج الآن',
          targetUrl: '/packages'
        }
      }
    };
  }

  if (['احجز', 'حجز عمرة', 'ابدأ الحجز', 'تأكيد العمرة', 'فاتورة', 'اريد حجز', 'أريد أن أحجز'].some(k => lower.includes(k))) {
    return {
      text: '🕋 تم توجيهك إلى **مسار حجز العمرة**. أربع خطوات: الباقة، الغرفة والإضافات، بياناتك، ثم الفاتورة وتأكيد الحساب.',
      action: { type: 'navigate', target: 'book' },
      actionCard: {
        type: 'action',
        data: {
          title: 'حجز العمرة خطوة بخطوة',
          description: 'اختر الباقة والإضافات وراجع الفاتورة ثم افتح حساب المعتمر.',
          buttonText: '🕋 ابدأ الحجز الآن',
          targetUrl: '/book'
        }
      }
    };
  }

  if (['افتح الباقات', 'صفحة الباقات', 'خذني للباقات', 'عرض الباقات', 'باقات العمرة'].some(k => lower.includes(k))) {
    return {
      text: '🚀 الباقات هي البرامج نفسها. تم فتح الكتالوج: التاريخ، الفندق، والسعر.',
      action: { type: 'navigate', target: 'packages' },
      actionCard: {
        type: 'action',
        data: {
          title: 'برامج العمرة والحج',
          description: 'نفس كتالوج البرامج: الفندق، السعر، والمقاعد.',
          buttonText: '🚀 افتح البرامج',
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

  if (['افتح المناسك', 'عداد الطواف', 'دليل المناسك', 'خطوات العمرة', 'عداد السعي', 'دليل العمرة'].some(k => lower.includes(k))) {
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

  if (['لوحة الادارة', 'لوحة المدير', 'لوحة الإدارة', 'صفحة الادمن', 'لوحة التحكم', 'admin dashboard'].some(k => lower.includes(k))) {
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

  if (['بوابة المعتمر', 'حسابي', 'الملف الشخصي', 'حجوزاتي', 'سنداتي'].some(k => lower.includes(k))) {
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
 * TOOL EXECUTION: Admin Live Database Queries, Table Data Viewer, Data Insertion & Formula Training
 */
export function detectAdminDbToolsIntent(prompt: string): { text: string; cards: AiCard[]; actions: AiAction[] } | null {
  const lower = prompt.toLowerCase().trim();

  // 1. Formula Training Intent: "عندما يسأل المعتمر عن X أجب بالنموذج التالي: Y" or "اعتمد صيغة X: Y"
  const formulaMatch = prompt.match(/(?:عندما يسأل المعتمر عن|صيغة الإجابة لـ|اعتمد الصيغة|درب صخر على|صيغة إجابة|نموذج إجابة)\s*(.*?)\s*(?:أجب بالنموذج|هي|تكون|بالصياغة التالية|:)\s*(.*)/i);
  if (formulaMatch && formulaMatch[1] && formulaMatch[2]) {
    const question = formulaMatch[1].trim();
    const responsePattern = formulaMatch[2].trim();

    if (question && responsePattern) {
      try {
        const db = getDatabase();
        const extractedWords = question
          .replace(/[؟?.,!،:;()[\]"']/g, ' ')
          .split(/\s+/)
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length > 2 && !['هذا', 'هذه', 'الذي', 'التي', 'إلى', 'على', 'عن', 'في', 'من'].includes(w));
        const allKeywords = Array.from(new Set([question.toLowerCase(), ...extractedWords]));

        const newRule: AiKnowledgeRule = {
          id: `rule_trained_${Date.now()}`,
          category: 'pricing',
          title_ar: question,
          keywords: allKeywords,
          response_ar: responsePattern,
          is_active: true,
          answerMode: 'official_exact',
          matchStrategy: 'keywords_or_title',
          updatedBy: 'Admin Sakhr Chat',
          updatedAt: new Date().toISOString()
        };
        db.aiKnowledge.unshift(newRule);
        saveDatabase(db);

        return {
          text: `🎉 **تم اعتماد نموذج الإجابة الرسمية بنجاح وحقنه في ذاكرة صخر AI!**\n\n📌 **السؤال/الاستفسار:** ${question}\n📝 **صيغة الإجابة المعتمدة:** ${responsePattern}`,
          cards: [
            {
              type: 'action',
              data: {
                title: 'تأكيد اعتماد صيغة الإجابة بنجاح',
                description: `تم إضافة قاعدة المعرفة لرقم (${newRule.id}) وحفظها مباشرة في قاعدة البيانات.`,
                buttonText: '📊 عرض قواعد المعرفة باللوحة',
                targetUrl: '/admin?tab=ai'
              }
            }
          ],
          actions: []
        };
      } catch (err: any) {
        console.error('[Formula Training Error]:', err?.message);
      }
    }
  }

  // 2. Display Table Data Intent: "أظهر لي جدول X", "اعرض جدول Y", "عرض بيانات جدول Z"
  const isTableViewQuery = ['أظهر لي جدول', 'اعرض جدول', 'عرض جدول', 'جدول بيانات', 'بيانات جدول', 'جدول الباقات', 'جدول الفنادق', 'جدول المرشدين', 'جدول المستخدمين', 'جدول قواعد المعرفة', 'جدول السندات', 'جدول الرسائل', 'جدول المواسم', 'أظهر الجداول', 'عرض الجداول', 'شاهد الجدول', 'show table', 'view table'].some(k => lower.includes(k));

  if (isTableViewQuery) {
    let tableName = 'packages'; // default if general
    let tableLabel = 'باقات العمرة والحج';

    if (lower.includes('فندق') || lower.includes('فنادق') || lower.includes('hotel')) {
      tableName = 'hotels'; tableLabel = 'الفنادق المعتمدة';
    } else if (lower.includes('مرشد') || lower.includes('طاقم') || lower.includes('morshid') || lower.includes('staff')) {
      tableName = 'morshids'; tableLabel = 'المرشدين وطاقم العمل';
    } else if (lower.includes('مستخدم') || lower.includes('حساب') || lower.includes('user')) {
      tableName = 'users'; tableLabel = 'المستخدمين والحسابات';
    } else if (lower.includes('معرفة') || lower.includes('قواعد') || lower.includes('rule') || lower.includes('تدريب')) {
      tableName = 'ai_knowledge'; tableLabel = 'قواعد معرفة صخر AI';
    } else if (lower.includes('سند') || lower.includes('سندات') || lower.includes('مالية') || lower.includes('receipt')) {
      tableName = 'receipts'; tableLabel = 'سندات القبض الرقمية';
    } else if (lower.includes('رسائل') || lower.includes('دردشة') || lower.includes('message')) {
      tableName = 'messages'; tableLabel = 'رسائل الدردشة';
    } else if (lower.includes('موسم') || lower.includes('مواسم') || lower.includes('season')) {
      tableName = 'seasons'; tableLabel = 'المواسم والرحلات';
    }

    try {
      const sqliteDb = getSqliteDb();
      const rows = sqliteDb.prepare(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT 100`).all() as any[];
      const columns = (sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => ({
        name: c.name,
        type: c.type,
        pk: Boolean(c.pk)
      }));

      return {
        text: `📊 **نافذة استعراض بيانات الجدول [${tableLabel}] (${rows.length} سطر في SQLite):**\n\nتفضل باستعراض وتصفية بيانات الجدول مباشرة في النافذة المرفقة أدناه:`,
        cards: [
          {
            type: 'db_table_viewer',
            data: {
              tableName,
              label: tableLabel,
              totalRows: rows.length,
              columns,
              rows
            }
          }
        ],
        actions: [
          { type: 'open_table_viewer', targetTable: tableName }
        ]
      };
    } catch (err: any) {
      console.error('[Table View Error]:', err?.message);
    }
  }

  // 3. Admin Data Insertion Intent & Ambiguous Table Select Prompt
  const isInsertQuery = ['أضف بيانات', 'إضافة بيانات', 'أضف في الجدول', 'إضافة سطر', 'أدخل بيانات', 'اضف باقة', 'اضف فندق', 'اضف مرشد', 'اضف مستخدم', 'insert table'].some(k => lower.includes(k));

  if (isInsertQuery) {
    let targetTable: string | null = null;
    let targetLabel: string | null = null;

    if (lower.includes('باقة')) { targetTable = 'packages'; targetLabel = 'باقات العمرة'; }
    else if (lower.includes('فندق')) { targetTable = 'hotels'; targetLabel = 'الفنادق المعتمدة'; }
    else if (lower.includes('مرشد')) { targetTable = 'morshids'; targetLabel = 'المرشدين وطاقم العمل'; }
    else if (lower.includes('مستخدم') || lower.includes('حساب')) { targetTable = 'users'; targetLabel = 'المستخدمين والحسابات'; }
    else if (lower.includes('معرفة') || lower.includes('قانون')) { targetTable = 'ai_knowledge'; targetLabel = 'قواعد المعرفة'; }

    if (targetTable) {
      return {
        text: `➕ **وضع إضافة البيانات إلى جدول [${targetLabel}]:**\n\nيرجى فتح نافذة الجدول أو استخدام لوحة التحكم لإدخال القيم المطلوبة وسيقوم صخر بتأكيد وإضافة السطر فوراً إلى SQLite.`,
        cards: [
          {
            type: 'action',
            data: {
              title: `إضافة بيانات جديدة إلى جدول [${targetLabel}]`,
              description: `الانتقال المباشر للوحة الإدارة لإضافة البيانات إلى ${targetLabel}.`,
              buttonText: `➕ فتح نموذج إضافة ${targetLabel}`,
              targetUrl: `/admin?tab=${targetTable === 'ai_knowledge' ? 'ai' : targetTable === 'users' ? 'users' : 'packages'}`
            }
          }
        ],
        actions: []
      };
    } else {
      // Ambiguous: Sakhr interactively asks Admin which table to add to!
      return {
        text: `🤔 **حدد الجدول الذي ترغب بالإقتراح والإضافة إليه:**\n\nلم أستطع تحديد الجدول المستهدف تلقائياً من طلبك. يرجى اختيار أحد الجداول المعتمدة أدناه لمتابعة إضافة البيانات:`,
        cards: [
          {
            type: 'table_selector_prompt',
            data: {
              title: 'اختيار جدول البيانات لإضافة جديد',
              options: [
                { name: 'packages', label: '📦 باقات العمرة والحج' },
                { name: 'hotels', label: '🏨 الفنادق المعتمدة' },
                { name: 'morshids', label: '👨‍💼 المرشدين وطاقم العمل' },
                { name: 'users', label: '👤 المستخدمين والحسابات' },
                { name: 'ai_knowledge', label: '📖 قواعد معرفة صخر AI' },
                { name: 'seasons', label: '🗓️ المواسم والرحلات' },
                { name: 'page_content', label: '📄 محتوى الصفحات' }
              ]
            }
          }
        ],
        actions: []
      };
    }
  }

  return null;
}

/**
 * TOOL EXECUTION: Morshid / Staff Discovery (Reads Live SQLite DB)
 */
export function detectMorchedIntent(prompt: string): { text: string; cards: AiCard[] } | null {
  const lower = prompt.toLowerCase();
  
  const isMurshidQuery = ['مرشد', 'مرشدين', 'mourshid', 'morshid', 'mourshdin', 'morched', 'guides', 'guide', 'شيخ', 'شيوخ', 'مرافقة دينية', 'مرافق', 'فقه'].some(k => lower.includes(k));
  const isStaffQuery = ['طاقم', 'فريق', 'الاعضاء', 'الأعضاء', 'الادارة', 'الإدارة', 'about us', 'من نحن', 'staff', 'team', 'members', 'مسؤولين', 'مسيرين'].some(k => lower.includes(k));
  const isWomenQuery = ['نساء', 'النساء', 'مرشدة', 'مرشدات', 'سيدات', 'أخوات', 'اخوات', 'women', 'female'].some(k => lower.includes(k));

  if (isMurshidQuery || isStaffQuery || isWomenQuery) {
    let category: string | undefined = undefined;
    if (isWomenQuery) category = 'women_guide';
    else if (isStaffQuery && !isMurshidQuery) category = 'staff';

    const teamMembers = toolGetTeamMembers(category);
    if (teamMembers.length === 0) return null;

    const cards: AiCard[] = teamMembers.map(member => ({
      type: 'morshid',
      data: member
    }));

    let introText = `✨ **طاقم وكالة ساوث ستريت والمرشدون الميدانيون المعتمدون:**\n\n`;
    if (isWomenQuery) {
      introText = `🧕 **المرشدات الدينيات لشؤون الأخوات والنساء بوكالة ساوث ستريت:**\n\nتتولى المرشدات مرافقة الأخوات المعتمرات في الصلوات والزيارات بالروضة الشريفة وأحكام الإحرام:\n\n`;
    } else if (isStaffQuery && !isMurshidQuery) {
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
 * TOOL EXECUTION: Packages & Offers Discovery (Reads Live SQLite DB)
 */
export function detectPackageOfferIntent(prompt: string): { text: string; cards: AiCard[] } | null {
  const lower = prompt.toLowerCase();
  const offerKeywords = ['عروض', 'عرض', 'offers', 'offer', 'باقات', 'باقة', 'packages', 'package', 'اسعار', 'أسعار', 'تخفيض', 'تخفيضات', 'سعر العمرة', 'تكلفة العمرة', 'رحلات', 'برامج'];

  if (offerKeywords.some(k => lower.includes(k))) {
    const packages = toolSearchPackages({ query: prompt.length < 20 ? undefined : prompt });

    if (packages.length === 0) return null;

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

    const anyPriced = packages.some(pkg => (pkg.prices || []).some(p => p && typeof p.amount === 'number' && p.amount > 0));
    if (!anyPriced && looksLikePriceQuestion(prompt)) {
      const agency = toolGetAgencySettings();
      return { text: sanitizeSakhrReply(buildUnknownPriceResponse(agency.phone).text), cards };
    }

    return {
      text: sanitizeSakhrReply(formatPackagesAnswer(packages, '🕋 **عروض وباقات العمرة المعتمدة (من قاعدة بيانات الوكالة)**')),
      cards
    };
  }

  return null;
}

/**
 * TOOL EXECUTION: Director, Accountant, Agency Location, and Installments (2 to 10 months) Intention
 */
export function detectAgencyCustomIntents(prompt: string): { text: string; cards: AiCard[]; actions: AiAction[]; map?: any } | null {
  const lower = prompt.toLowerCase();

  // 1. Director Query
  if (['المدير', 'مدير', 'من هو المدير', 'مدير الوكالة', 'المدير العام', 'المؤسس', 'صاحب الوكالة', 'رئيس الوكالة', 'director'].some(k => lower.includes(k))) {
    return {
      text: `👔 **المدير العام والمؤسس لوكالة ساوث ستريت للأسفار والعمرة:**\n\n• **الاسم الكامل:** الأستاذ طارق العماري (المدير العام ورئيس مجلس الإدارة).\n• **الخبرة القيادية:** أكثر من 18 سنة في إدارة رحلات الحج والعمرة، التعاقدات الفندقية بمكة والمدينة، والرحلات الجوية المباشرة.\n• **المهام والمتابعة:** الإشراف المباشر على جودة التأطير، متابعة الحجاج والمعتمرين 24/7، وتوفير كافة التسهيلات لضيوف الرحمن.`,
      cards: [
        {
          type: 'morshid',
          data: {
            name: 'الأستاذ طارق العماري',
            roleName: 'المدير العام ورئيس مجلس الإدارة',
            specialization: 'الإشراف العام، التعاقدات الفندقية والخطوط الجوية المباشرة 24/7',
            experience_years: 18,
            languages: ['العربية', 'الفرنسية', 'الإنجليزية'],
            phone: '+21321554433',
            avatar: 'ط',
            rating: 5.0,
            status: 'في الخدمة (مقر الإدارة العامة)'
          }
        }
      ],
      actions: []
    };
  }

  // 2. Accountant Query
  if (['المحاسب', 'محاسب', 'من هو المحاسب', 'المحاسب المالي', 'قسم المالية', 'المالية', 'سند القبض', 'الفواتير', 'accountant'].some(k => lower.includes(k))) {
    return {
      text: `💼 **المحاسب المالي الرئيسي بوكالة ساوث ستريت:**\n\n• **الاسم الكامل:** الأستاذ ياسين الفاسي (محاسب الوكالة المعتمد ورئيس الشؤون المالية).\n• **المهام المالية:** اعتماد التحويلات البنكية وبريدي موب، متابعة الدفعات والسندات الرقمية، وتنظيم جدولة التقسيط الميسر من 2 إلى 10 أشهر.\n• **الهاتف المباشر للمحاسب:** +213 561 11 88 99 | 📧 accountant@southstreet.dz`,
      cards: [
        {
          type: 'morshid',
          data: {
            name: 'الأستاذ ياسين الفاسي',
            roleName: 'المحاسب المالي الرئيسي بوكالة ساوث ستريت',
            specialization: 'إصدار السندات الرقمية، اعتماد التحويلات، وتنسيق خطط التقسيط (2-10 أشهر)',
            experience_years: 14,
            languages: ['العربية', 'الفرنسية'],
            phone: '+213561118899',
            avatar: 'ي',
            rating: 4.95,
            status: 'متاح للخدمات المالية والسندات'
          }
        }
      ],
      actions: []
    };
  }

  // 3. Agency Address / Location Query
  if (['عنوان', 'العنوان', 'مقر', 'المقر', 'أين', 'اين', 'موقع', 'مكان', 'الاتجاه', 'اتجاه', 'مكتب', 'الجزائر العاصمة', 'address', 'location'].some(k => lower.includes(k))) {
    return {
      text: `📍 **عنوان ومقر القيادة والإدارة العامة لوكالة ساوث ستريت:**\n\n🏢 **المقر الرئيسي:** شارع 01 نوفمبر 1954 (ساوث ستريت)، الجزائر العاصمة.\n🧭 **الاتجاه والموقع:** بجوار ساحة أودان ومحطة هواري بومدين / الجزائر العاصمة.\n⏰ **أوقات العمل:** الأحد إلى الخميس من 08:30 صباحاً إلى 17:30 مساءً.\n🌐 **المكاتب المعتمدة:** فرع الجزائر العاصمة، فرع وهران، وفرع عنابة.\n📞 **هاتف الاستقبال:** +213 21 55 44 33 | 💬 **واتساب:** +213 550 12 34 56`,
      cards: [
        {
          type: 'action',
          data: {
            title: 'المقر الرئيسي لوكالة ساوث ستريت (الجزائر العاصمة)',
            description: 'شارع 01 نوفمبر 1954، بجوار ساحة أودان، الجزائر العاصمة.',
            buttonText: '📍 فتح موقع الوكالة بالخريطة',
            targetUrl: '/portal'
          }
        }
      ],
      map: {
        title: 'المقر الرئيسي لوكالة ساوث ستريت - الجزائر العاصمة',
        latitude: 36.7753,
        longitude: 3.0588
      },
      actions: []
    };
  }

  // 4. Installments & Payment Facility Query
  if (['تقسيط', 'التقسيط', 'تسهيلات', 'دفعات', 'أشهر', 'اشهر', 'بالتقسيط', '2 الى 10', 'من 2 الى 10', 'شروط التقسيط', 'اقساط', 'أقساط', 'installment'].some(k => lower.includes(k))) {
    return {
      text: `💳 **تسهيلات الدفع والتقسيط الميسر بوكالة ساوث ستريت (من 2 إلى 10 أشهر):**\n\nتقدم الوكالة نظام **التقسيط المريح بدون فوائد** لجميع باقات العمرة والحج لعام 2026:\n\n1. **فترة التقسيط المرنة:** يمكنك تقسيط تكلفة الرحلة على فترة تتراوح بين **شهريين (2) وحتى 10 أشهر كاملة**.\n2. **الدفعة الأولى:** تسديد دفعة تأكيد أولى (من 20% إلى 30%) عند تقديم وتثبيت الملف.\n3. **طرق السداد:** أقساط شهرية ميسرة عبر تطبيق بريدي موب (BaridiMob)، الحساب الجاري البريدي CCP، أو نقداً بالمقر.\n4. **السندات الرسمية:** إصدار سند قبض رقمي فوري معتمد فور كل دفعة شهرية من المحاسب المالي الأستاذ ياسين الفاسي.`,
      cards: [
        {
          type: 'action',
          data: {
            title: 'طلب جدول تقسيط مخصص (2 - 10 أشهر)',
            description: 'تواصل مع المحاسب المالي أو زر مقر الوكالة لتعديل الخطة وطلب جدول الدفعات.',
            buttonText: '💬 التواصل مع المحاسب المالي',
            targetUrl: '/portal?tab=chat'
          }
        }
      ],
      actions: []
    };
  }

  return null;
}

/**
 * Response when question is not in the knowledge database yet
 */
export function buildNoKnowledgeResponse(prompt: string, externalFailed = false) {
  const agency = toolGetAgencySettings();
  // Never mention API keys / .env to end users (even when external AI failed).
  const base = buildClarifyingFallback(prompt, agency.phone);
  const soft = externalFailed
    ? '\n\n⏳ تعذّر الاتصال بالمساعد الخارجي مؤقتاً — يمكنك إعادة المحاولة أو توضيح سؤالك.'
    : '';
  return {
    ...base,
    text: sanitizeSakhrReply(base.text + soft),
    cards: [],
    actions: [],
    noKnowledge: true,
  };
}

export async function generateLocalRagResponse(prompt: string) {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Greetings
  if (['مرحبا', 'مرحباً', 'سلام', 'السلام عليكم', 'أهلا', 'اهلا', 'صباح الخير', 'مساء الخير', 'hi', 'hello'].some(g => lower.includes(g))) {
    const agency = toolGetAgencySettings();
    const inventory = toolGetSiteInventory();
    const pageList = inventory.map(p => `• ${p.title}`).join('\n');
    return {
      text: `أهلاً وسهلاً بك في وكالة **${agency.agency_name || 'ساوث ستريت'}** 🕋\n\nأنا **صخر**، مساعدك الذكي. أستطيع الإجابة عن أي عنصر في التطبيق وفتح أي صفحة أو قسم لك.\n\n**الصفحات المتاحة:**\n${pageList}\n\n💡 جرّب: "افتح قسم المرشدين" أو "ما هي الباقات المتاحة؟"`,
      cards: inventory.slice(0, 4).map(p => ({
        type: 'action',
        data: {
          title: p.title,
          description: p.description,
          buttonText: `↗ ${p.title}`,
          targetUrl: p.path,
        },
      })),
    };
  }

  // 2. Check general knowledge dictionary (hardcoded quick facts only)
  for (const [key, answer] of Object.entries(GENERAL_KB)) {
    if (lower.includes(key)) {
      return { text: answer, cards: [] };
    }
  }

  // 3. High-confidence sitemap matches only (navigation help, not factual Q&A)
  const appMatches = toolSearchAppContent(cleanPrompt, 3);
  const isNavLike = ['افتح', 'اذهب', 'خذني', 'عرض', 'صفحة', 'قسم', 'انتقل'].some(v => lower.includes(v));
  if (isNavLike && appMatches.length > 0 && appMatches[0].score >= 20) {
    const cards: AiCard[] = appMatches.map(m => {
      const label = m.type === 'section' && m.section ? m.section.title : m.page.title;
      const desc = m.type === 'section' && m.section ? m.section.description : m.page.description;
      const path = m.type === 'section' && m.section?.anchor
        ? `${m.page.path}${m.section.anchor}`
        : m.page.path;
      return {
        type: 'action',
        data: { title: label, description: desc, buttonText: `↗ ${label}`, targetUrl: path },
      };
    });
    let text = `🔍 **وجدت ${appMatches.length} عناصر ذات صلة:**\n\n`;
    appMatches.forEach(m => {
      const label = m.type === 'section' && m.section ? m.section.title : m.page.title;
      text += `• **${label}**\n`;
    });
    return { text, cards };
  }

  // 4. Members knowledge/ markdown (packages, prices, faq) — grounded only
  try {
    const kr = await KnowledgeReader.search(cleanPrompt, 4);
    if (kr.chunks && kr.chunks.length > 0 && (kr.chunks[0].score || 0) >= 0.35) {
      const top = kr.chunks.slice(0, 3);
      let text = '📚 **من معرفة الوكالة المعتمدة:**\n\n';
      for (const c of top) {
        text += `### ${c.heading}\n${String(c.content || '').slice(0, 700)}\n\n`;
      }
      if (looksLikePriceQuestion(cleanPrompt) && !/\d{3,}/.test(text)) {
        const agency = toolGetAgencySettings();
        return {
          text: sanitizeSakhrReply(buildUnknownPriceResponse(agency.phone).text),
          cards: [],
          trusted: true,
          externalAi: false,
          sourceType: 'agency_db' as const,
          source: 'knowledge_files',
          sourceLabel: 'ملفات المعرفة (بدون سعر رقمي)',
        };
      }
      return {
        text: sanitizeSakhrReply(text.trim()),
        cards: [],
        trusted: true,
        externalAi: false,
        sourceType: 'agency_db' as const,
        source: 'knowledge_files',
        sourceLabel: 'ملفات معرفة الوكالة',
      };
    }
  } catch {
    /* knowledge folder optional */
  }

  // 5. Price question with no grounded numbers — refuse invention
  if (looksLikePriceQuestion(cleanPrompt)) {
    const agency = toolGetAgencySettings();
    const unk = buildUnknownPriceResponse(agency.phone);
    return { ...unk, text: sanitizeSakhrReply(unk.text) };
  }

  // 6. Honest clarifying gap response
  return buildNoKnowledgeResponse(cleanPrompt);
}
