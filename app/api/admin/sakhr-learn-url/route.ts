import { NextResponse } from 'next/server';
import { getDatabase, saveDatabase, dbLogAiConversation, dbGetAgencySettings } from '@/lib/db';
import { AiKnowledgeRule } from '@/lib/db';

// Extract clean text from HTML
function extractCleanText(html: string): { title: string; text: string; keywords: string[] } {
  let title = 'معرفة جديدة من موقع إلكتروني';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/\s+/g, ' ').trim();
  }

  // Remove scripts, styles, and tags
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

  // Extract first 1500 clean characters
  clean = clean.substring(0, 1500);

  // Extract keywords from title and text
  const words = clean.split(/[\s,،.؛:]+/).filter(w => w.length > 3);
  const uniqueKeywords = Array.from(new Set(words)).slice(0, 8);

  return { title, text: clean, keywords: uniqueKeywords };
}

export async function POST(req: Request) {
  try {
    const { url, category = 'faq' } = await req.json();
    const cleanUrl = (url || '').trim();

    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'يرجى إدخال رابط موقع إلكتروني صحيح يبدأ بـ http أو https' },
        { status: 400 }
      );
    }

    // 1. Fetch content from web URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `تعذر الاتصال بالموقع (${res.status}). يرجى التأكد من أن الرابط عام ومتاح.` },
        { status: 400 }
      );
    }

    const html = await res.text();
    const extracted = extractCleanText(html);

    if (!extracted.text || extracted.text.length < 30) {
      return NextResponse.json(
        { error: 'لم يتم العثور على محتوى نصي كافٍ بالموقع المستهدف.' },
        { status: 400 }
      );
    }

    // 2. Format new AI Knowledge Rule
    const db = getDatabase();
    if (!db.aiKnowledge) db.aiKnowledge = [];

    const newRuleId = `rule_web_${Date.now()}`;
    const newRule: AiKnowledgeRule = {
      id: newRuleId,
      category: category as any,
      title_ar: `🌐 ${extracted.title}`,
      keywords: [extracted.title.split(' ')[0], ...extracted.keywords].filter(Boolean).slice(0, 7),
      response_ar: `📖 **معلومات مستخرجة حديثاً من (${cleanUrl}):**\n\n${extracted.text.substring(0, 600)}...\n\n💡 قام صخر بتعلم هذه القاعدة تلقائياً من الموقع الإلكتروني.`,
      is_active: true,
      updatedBy: 'developer@southstreet.dz',
      updatedAt: new Date().toISOString()
    };

    db.aiKnowledge.unshift(newRule);
    saveDatabase(db);

    return NextResponse.json({
      success: true,
      message: '🎉 تم تعلم واستخراج المعرفة من الموقع بنجاح وإضافتها لقاعدة صخر AI!',
      rule: newRule
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `خطأ في معالجة الموقع: ${error.message || 'تعذر القراءة'}` },
      { status: 500 }
    );
  }
}
