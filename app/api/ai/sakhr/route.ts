import { NextResponse } from 'next/server';
import { KnowledgeReader } from '@/lib/knowledge/knowledge-reader';
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
  toolComparePackages
} from '@/lib/ai-tools';

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SAKHR AI — PRODUCTION AI AGENT WITH LIVE SQLITE TOOLS & DIRECT GEMINI LLM   │
 * │  Tier 0: Sub-millisecond Instant DB Rules & Navigation Actions             │
 * │  Tier 1: Live SQLite AI Tools (Packages, Morshids, Hotels, Seasons, Agency) │
 * │  Tier 2: Direct Google Gemini 1.5 Flash LLM (Free Tier - Injected DB Data) │
 * │  Tier 3: Local RAG Knowledge Engine & Smart Multi-modal Fallback            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// General Knowledge Base for instant answers
const GENERAL_KB: Record<string, string> = {
  'جبل': 'ف أعلى قمة جبلية في العالم هي قمة إيفرست في سلسلة جبال الهيمالايا، ويصل ارتفاعها إلى حوالي 8,848 متراً فوق سطح البحر. أما في الجزائر فأعلى قمة هي قمة تاهات آتاكور في الهقار بارتفاع 2,908 م.',
  'المانيا': '🇩🇪 مساحة ألمانيا الإجمالية تبلغ حوالي 357,588 كيلومتر مربع (357,588 كم²). وعاصمتها برلين.',
  'ألمانيا': '🇩🇪 مساحة ألمانيا الإجمالية تبلغ حوالي 357,588 كيلومتر مربع (357,588 كم²). وعاصمتها برلين.',
  'عاصمة': '🏛️ يمكنك الاستفسار عن عاصمة أو تفاصيل أي دولة، ويسعدني تزويدك بالمعلومات الجغرافية والخدمية فوراً.',
};

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

    if (!res.ok) return null;

    const html = await res.text();
    const { title, text } = extractCleanTextFromHtml(html);
    if (!text || text.length < 20) return null;

    return { title, text: text.substring(0, 800), url };
  } catch {
    return null;
  }
}

/**
 * Detect Navigation Intent and Deep App Pages
 */
function detectNavigationIntent(prompt: string): { action?: AiAction; actionCard?: AiCard; text?: string } | null {
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
      text: '📋 تم توجيهك إلى قسم **البرامج والرحلات** المتاحة حالياً.',
      action: { type: 'navigate', target: 'packages' },
      actionCard: {
        type: 'action',
        data: {
          title: 'برامج ورحلات العمرة 2026',
          description: 'استعراض باقة أوت الاقتصادية وباقة المولد النبوي VIP.',
          buttonText: '📋 تصفح البرامج الآن',
          targetUrl: '/packages'
        }
      }
    };
  }

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
function detectAdminDbToolsIntent(prompt: string): { text: string; cards: AiCard[]; actions: AiAction[] } | null {
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
              title: 'اختيار جدول البيانات لإضافة سطر جديد',
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
function detectMorchedIntent(prompt: string): { text: string; cards: AiCard[] } | null {
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
function detectPackageOfferIntent(prompt: string): { text: string; cards: AiCard[] } | null {
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

    return {
      text: `🕋 **عروض وباقات العمرة والحج 2026 المتاحة حالياً بوكالة ساوث ستريت (مستخرجة مباشرة من قاعدة البيانات):**\n\nتفضل باستعراض تفاصيل البرامج المتاحة، الفنادق، والأسعار المعتمدة مع إمكانية الحجز المباشر:`,
      cards
    };
  }

  return null;
}

/**
 * TOOL EXECUTION: Director, Accountant, Agency Location, and Installments (2 to 10 months) Intention
 */
function detectAgencyCustomIntents(prompt: string): { text: string; cards: AiCard[]; actions: AiAction[]; map?: any } | null {
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
 * Built-in fallback AI generator using local knowledge base
 */
async function generateLocalRagResponse(prompt: string) {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Greetings
  if (['مرحبا', 'مرحباً', 'سلام', 'السلام عليكم', 'أهلا', 'اهلا', 'صباح الخير', 'مساء الخير', 'hi', 'hello'].some(g => lower.includes(g))) {
    const agency = toolGetAgencySettings();
    return {
      text: `أهلاً وسهلاً بك في وكالة **${agency.agency_name || 'ساوث ستريت'}** للسياحة والأسفار والحج والعمرة 🕋✨\n\nأنا **صخر**، مساعدك الذكي المباشر. كيف يمكنني خدمتك اليوم؟\n- 💰 **الاستفسار عن أسعار وباقات العمرة 2026**\n- 🧭 **طلب التواصل مع المرشد الديني أو تصفح المرشدين**\n- ✈️ **الانتقال لصفحات التطبيق (الباقات، الفنادق، المناسك، السندات)**\n- 🌐 **البحث واستخراج الإجابات المباشرة**`,
      cards: []
    };
  }

  // 2. Check general knowledge dictionary
  for (const [key, answer] of Object.entries(GENERAL_KB)) {
    if (lower.includes(key)) {
      return { text: answer, cards: [] };
    }
  }

  // 3. Search local Knowledge Base files
  const searchResult = await KnowledgeReader.search(cleanPrompt, 3);
  if (searchResult && searchResult.chunks.length > 0 && searchResult.chunks[0].score > 0) {
    let responseText = `🕋 **معلومات وكالة ساوث ستريت الرسمية:**\n\n`;
    searchResult.chunks.forEach((chunk) => {
      responseText += `📌 **${chunk.heading}**\n${chunk.content}\n\n`;
    });

    return { text: responseText.trim(), cards: [] };
  }

  // 4. Default helpful answer
  const agency = toolGetAgencySettings();
  return {
    text: `شكراً لتواصلك مع **${agency.agency_name || 'ساوث ستريت'}** 🕋\n\nبخصوص استفسارك عن: **"${cleanPrompt}"**\nيسعدنا تزويدك بكافة تفاصيل رحلات العمرة والحج لعام 2026 مع نخبة من المرشدين المعتمدين وفنادق بجوار الحرمين الشريفين.\n\n📞 للتواصل المباشر مع فريق الوكالة: **${agency.phone || '+213 21 55 44 33'}**`,
    cards: []
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = (body.prompt || '').trim();
    const history = body.history || [];

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
    // TOOL 1.5: Admin Database Inspection, Table Viewer, Data Insertion & Formula Training
    // ─────────────────────────────────────────────────────────────
    const dbToolsResult = detectAdminDbToolsIntent(prompt);
    if (dbToolsResult) {
      return NextResponse.json(dbToolsResult);
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 2: Morched (Guide) & Team Discovery (SQLite Query)
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
    // TOOL 3: Live Packages & Offers Tool (SQLite Query)
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
    // TOOL 3.5: Director, Accountant, Agency Headquarters & Installments (2 to 10 months)
    // ─────────────────────────────────────────────────────────────
    const customResult = detectAgencyCustomIntents(prompt);
    if (customResult) {
      return NextResponse.json(customResult);
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 4: Live Web Page Scraper Tool (if URL provided)
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
    const dbMatch = toolSearchKnowledge(prompt);
    if (dbMatch) {
      const rule = dbMatch.rule;
      const cards: AiCard[] = [];
      const actions: AiAction[] = [];

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
      }

      const selectedAnswer = rule.modelAnswer || rule.response_ar;
      return NextResponse.json({ text: selectedAnswer, cards, actions });
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 1: Direct Google Gemini 1.5 Flash LLM with Injected SQLite Context
    // ─────────────────────────────────────────────────────────────
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.SAKHR_GEMINI_KEY;
    if (geminiApiKey) {
      try {
        const agency = toolGetAgencySettings();
        const packages = toolSearchPackages();
        const team = toolGetTeamMembers();
        const hotels = toolGetHotelsInfo();
        const seasons = toolGetSeasonsInfo();

        const sqliteContext = `
معلومات قاعدة البيانات الحية (SQLite Real-time Authority):
- الوكالة: ${agency.agency_name} | هاتف: ${agency.phone} | واتساب: ${agency.whatsapp} | عنوان: ${agency.address}
- الباقات المتاحة (${packages.length} باقة): ${packages.map(p => `${p.name} (السعر الأقل: ${p.prices?.[0]?.amount || 'محدد'} دج - المتبقي: ${p.available} مقعد)`).join('؛ ')}
- المرشدين وطاقم العمل (${team.length} عضو): ${team.map(t => `${t.name} (${t.roleName})`).join('؛ ')}
- الفنادق المعتمدة (${hotels.length} فندق): ${hotels.map(h => `${h.name} (${h.distance_from_haram})`).join('؛ ')}
- المواسم الحالية: ${seasons.map(s => `${s.name} (${s.status})`).join('؛ ')}
`;

        const systemInstruction = `أنت صخر، المساعد الذكي لوكالة ${agency.agency_name || 'ساوث ستريت'} بالجزائر.
أجب بلباقة ولغة عربية راقية ومباشرة. الالتزام التام بالمعلومات المرفقة أدناه دون اختراع أو تخمين أسعار أو رحلات غير موجودة.
${sqliteContext}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemInstruction}\n\nسؤال المستخدم: ${prompt}` }]
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
        console.warn('[Gemini API Error] Falling back to local engine:', geminiErr?.message);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: Local Engine & Smart Fallback
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
