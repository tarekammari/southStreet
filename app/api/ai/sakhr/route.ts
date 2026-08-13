import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDatabase } from '@/lib/db';

// 🌐 1. Live Web Search Engine (Wikipedia & Internet Fact Fetcher)
async function fetchWebSearch(query: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'SouthStreetAI/1.0 (https://southstreet.dz)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const results = data?.query?.search;
      if (results && results.length > 0) {
        const topResult = results[0];
        const title = topResult.title;
        const cleanSnippet = topResult.snippet.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').trim();
        if (cleanSnippet && cleanSnippet.length > 20) {
          return `🌐 **معلومات من البحث على الإنترنت (${title}):**\n\n${cleanSnippet}...\n\n💡 صخر قام بالبحث في شبكة الإنترنت لجلب هذه المعلومة لك.`;
        }
      }
    }
  } catch (e) {}
  return null;
}

// 🤖 2. Gemini AI with Google Search Grounding
async function fetchGeminiAi(apiKey: string, prompt: string, history: any[] = []): Promise<string | null> {
  const logEntries: string[] = [];
  logEntries.push(`[${new Date().toISOString()}] Testing Prompt: "${prompt}" with Key: ${apiKey}`);

  const systemInstructionText = `أنت "صخر"، المساعد الذكي التفاعلي الخبير لوكالة "ساوث ستريت" للرحلات والعمرة والحج بالجزائر. 
إذا كان السؤال يخص الوكالة أو العمرة أو الشروط، أجب من معلومات الوكالة.
إذا كان السؤال عاماً أو يخص الجغرافيا، العلوم، التاريخ، أو معارف الإنترنت العامة، ابحث في شبكة الإنترنت وأعط المستخدم إجابة دقيقة ودقيقة جداً.
معلومات الوكالة:
- باقة أوت المميزة: 215,000 دج (طيران مباشر + فندق منارات غزة 350م من الحرم المكي).
- باقة المولد النبوي VIP: 295,000 دج (فندق سويس أوتيل برج الساعة 50م عن صحن الحرم المكي).
- طيران مباشر بدون توقف من الجزائر، وهران، وعنابة عبر الخطوط الجوية الجزائرية والخطوط السعودية.
- الشروط: جواز سفر بيومتري صالح 6 أشهر، صور شمسية، دفتر العائلة، دفتر التلقيح.

أجب بلغة عربية فصيحة، منظمة، دقيقة ومبسطة مع استخدام النقاط وتظليل النقاط الهامة **بالعريض**.`;

  const contentsPayload = [
    ...(history || []).slice(-4).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })),
    {
      role: 'user',
      parts: [{ text: `${systemInstructionText}\n\nسؤال المستخدم: ${prompt}` }]
    }
  ];

  // Primary Attempt: gemini-flash-latest with Google Search Grounding
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({ 
          contents: contentsPayload,
          tools: [{ googleSearch: {} }]
        }),
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    const resText = await res.text();
    logEntries.push(`Attempt Flash-Latest Status: ${res.status}\nBody: ${resText}`);

    if (res.ok) {
      const data = JSON.parse(resText);
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer && answer.trim()) {
        try { fs.writeFileSync('./gemini_api_debug.log', logEntries.join('\n\n'), 'utf8'); } catch(e){}
        return answer.trim();
      }
    }
  } catch (e: any) {
    logEntries.push(`Attempt Flash-Latest Error: ${e.message}`);
  }

  // Fallback Attempt B: gemini-1.5-flash standard
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contentsPayload }),
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    const resText = await res.text();
    logEntries.push(`Attempt B Status: ${res.status}\nBody: ${resText}`);

    if (res.ok) {
      const data = JSON.parse(resText);
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer && answer.trim()) {
        try { fs.writeFileSync('./gemini_api_debug.log', logEntries.join('\n\n'), 'utf8'); } catch(e){}
        return answer.trim();
      }
    }
  } catch (e: any) {
    logEntries.push(`Attempt B Error: ${e.message}`);
  }

  try { fs.writeFileSync('./gemini_api_debug.log', logEntries.join('\n\n'), 'utf8'); } catch(e){}
  return null;
}

// 🌍 3. Real Free LLM (Pollinations AI Fast Engine)
async function fetchPollinationsAi(prompt: string, history: any[] = []): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const systemPrompt = `أنت "صخر"، المساعد الذكي التفاعلي لوكالة "ساوث ستريت" للرحلات والعمرة والحج بالجزائر. 
أجب عن جميع أسئلة المستخدم (سواء عن العمرة، الحج، الوكالة، أو أي سؤال عام كالعلوم والجغرافيا والمعلومات العامة على الإنترنت) بأسلوب منظّم وواضح ودقيق جداً وبـ الذكاء الاصطناعي الحقيقي.`;

    const encodedPrompt = encodeURIComponent(prompt);
    const encodedSystem = encodeURIComponent(systemPrompt);
    const url = `https://text.pollinations.ai/${encodedPrompt}?system=${encodedSystem}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 5 && !text.includes('Error')) {
        return text.trim();
      }
    }
  } catch (e) {}
  return null;
}

// 🏛️ 4. Local App & Agency Knowledge Engine
function getSakhrConditionResponse(prompt: string): string {
  const p = (prompt || '').trim().toLowerCase();

  // Priority 0: Check Live Encrypted Database Rules created by Admin Dashboard
  try {
    const db = getDatabase();
    const activeRules = (db.aiKnowledge || []).filter(r => r.is_active);
    for (const rule of activeRules) {
      if (rule.keywords && rule.keywords.some(k => p.includes(k.toLowerCase()))) {
        return rule.response_ar;
      }
    }
  } catch (e) {}

  if (p.includes('مناسك') || p.includes('خطوات العمرة') || p.includes('كيفية العمرة') || p.includes('طواف') || p.includes('سعي') || p.includes('إحرام') || p.includes('احرام')) {
    return `🕋 **خطوات ومناسك العمرة بالتفصيل:**

1. 🧼 **الإحرام:** النظافة، لبس ملابس الإحرام، ونية العمرة ("لبيك اللهم عمرة") من الميقات.
2. 🔄 **الطواف:** الطواف حول الكعبة المشرفة 7 أشواط بدءاً من الحجر الأسود، ثم صلاة ركعتين خلف مقام إبراهيم.
3. 🏃 **السعي:** السعي بين الصفا والمروة 7 أشواط بدءاً من الصفا وانتهاءً بالمروة.
4. ✂️ **الحلق أو التقصير:** تحلل الإحرام بحلق الشعر أو تقصيره (وللنساء تقصير قدر أنملة).

💡 **ملاحظة:** توفر وكالة ساوث ستريت مرشدين ودعاة متمكنين لمرافقتك خطوة بخطوة أثناء أداء كافة المناسك!`;
  }

  if (p.includes('مرحبا') || p.includes('سلام') || p.includes('أهلا') || p.includes('اهلا') || p.includes('صباح') || p.includes('مساء')) {
    return `👋 **أهلاً وسهلاً بك! أنا "صخر" المساعد الذكي لوكالة ساوث ستريت.**

يسعدني مرافقتك والإجابة عن جميع استفساراتك حول باقات العمرة، المناسك، الشروط المطلوبة، الفنادق والقرب من الحرم، ورحلات الطيران المباشر.

كيف يمكنني مساعدتك اليوم؟`;
  }

  if (p.includes('عرف عن نفسك') || p.includes('عرف بنفسك') || p.includes('من أنت') || p.includes('من انت') || p.includes('شكون أنت') || p.includes('شكون انت') || p.includes('ما هو دورك')) {
    return `🤖 **أنا "صخر" (Sakhr AI) — المساعد الذكي لوكالة ساوث ستريت لتنظيم رحلات العمرة والحج.**

• **ماذا أقدم لك؟**
1. **توفير معلومات دقيقة:** حول الشروط والوثائق الرسمية للتسجيل ومناسك العمرة.
2. **عرض الباقات والأسعار:** باقة أوت (215,000 دج) وباقة المولد VIP (295,000 دج).
3. **تفاصيل الإقامة:** فنادق مكة والمدينة القريبة جداً من الحرمين الشريفين (350م - 600م).
4. **تسهيلات السفر:** رحلات طيران مباشر وتأطير ديني وإداري احترافي.`;
  }

  if (p.includes('عرض') || p.includes('عروض') || p.includes('برنامج') || p.includes('برامج') || p.includes('لديكم') || p.includes('عندكم') || p.includes('متوفر')) {
    return `✨ **العروض والبرامج المتوفرة حالياً لدى وكالة ساوث ستريت:**

1. 🕋 **باقة أوت الاقتصادية المميزة (215,000 دج):**
   • طيران مباشر بدون توقف (الجزائر / وهران / عنابة).
   • فندق منارات غزة بمكة (350م فقط عن صحن الحرم المكي).

2. 🌟 **باقة المولد النبوي VIP (295,000 دج):**
   • إقامة فاخرة بفندق سويس أوتيل برج الساعة (50م عن صحن الحرم).
   • إعاشة كاملة وتأطير ديني خاص مع المرشدين والدعاة.

3. ✈️ **رحلات عمرة بالطلب وتسهيلات دفع ميسرة** عبر البوابة.`;
  }

  if (p.includes('شرط') || p.includes('شروط') || p.includes('وثائق') || p.includes('ملف') || p.includes('أوراق') || p.includes('تجهيز')) {
    return `📋 **شروط وأوراق التقديم للعمرة مع وكالة ساوث ستريت:**

1. **جواز سفر بيومتري** صالح لمدة لا تقل عن 6 أشهر.
2. **عدد 2 صور شمسية** بخلفية بيضاء.
3. **دفتر العائلة** أو شهادة الميلاد للمحارم.
4. **شهادة تلقيح رسمية** (وفق التعليمات الصحية).
5. **تسديد دفعة الحجز الأولى (30%)** واستكمال المبلغ قبل سفر الرحلة بـ 15 يوماً.`;
  }

  if (p.includes('سعر') || p.includes('أسعار') || p.includes('باقة') || p.includes('تكلفة') || p.includes('سعرها') || p.includes('دج')) {
    return `💰 **باقات وأسعار العمرة والحج لدى ساوث ستريت:**

• **باقة أوت الاقتصادية المميزة:** 215,000 دج (طيران مباشر + فندق منارات غزة 350م عن الحرم المكي).
• **باقة المولد النبوي VIP:** 295,000 دج (إقامة فاخرة بسويس أوتيل برج الساعة 50م عن صحن الحرم المكي).
• **تسهيلات الدفع:** الدفع على دفعات ميسرة (30% عند الحجز والباقي قبل السفر).`;
  }

  if (p.includes('فندق') || p.includes('إقامة') || p.includes('حرم') || p.includes('قريب') || p.includes('غرفة')) {
    return `🏨 **الفنادق والقرب من الحرم المكي والنبوي:**

• **مكة المكرمة:** فنادق منارات غزة وميسان المقام (350م إلى 600م فقط عن صحن الحرم المكي الشريف).
• **المدينة المنورة:** فنادق فاخرة بالمنطقة المركزية الشمالية والجنوبية (خطوات عن المسجد النبوي).
• **المميزات:** غرف مجهزة، تكييف مركزي، شاشات ذكية وإعاشة بوفيه مفتوح.`;
  }

  if (p.includes('مطار') || p.includes('مطارات') || p.includes('حجز طيران') || (p.includes('طيران') && (p.includes('مباشر') || p.includes('وهران') || p.includes('عنابة')))) {
    return `✈️ **الرحلات الجوية والمطارات المتاحة:**

• **طيران مباشر بدون توقف** عبر الخطوط الجوية الجزائرية والخطوط السعودية.
• **مطارات الانطلاق:** مطار هواري بومدين (الجزائر)، مطار أحمد بن بلة (وهران)، ومطار رابح بيطاط (عنابة).
• **يشمل العرض:** شحن الأمتعة واستقبال بحافلات VIP في جدة والمدينة.`;
  }

  if (p.includes('مساحة الجزائر') || (p.includes('مساحة') && p.includes('جزائر'))) {
    return `🇩🇿 **مساحة الجزائر:**
تبلغ مساحة الجمهورية الجزائرية الديمقراطية الشعبية **2,381,741 كيلومتر مربع**، وهي أكبر دولة في إفريقيا والعالم العربي والبحيرة المتوسطية مساحةً.`;
  }

  if (p.includes('قمر') || p.includes('مساحة القمر')) {
    return `🌕 **مساحة سطح القمر:**
تبلغ مساحة سطح القمر حوالي **37.9 مليون كيلومتر مربع** (أي ما يعادل نحو 7.4% من مساحة سطح كوكب الأرض).`;
  }

  return `🤖 **أنا صخر المساعد الذكي:** 
استفسارك محل اهتمامي. يمكنني الإجابة عن **مناسك العمرة، الشروط والوثائق، أسعار الباقات، الفنادق، ورحلات الطيران المباشر** أو أي استفسار آخر ترغب في معرفته!`;
}

export async function POST(req: Request) {
  try {
    const { prompt, history } = await req.json();
    const cleanPrompt = (prompt || '').trim();

    if (!cleanPrompt) {
      return NextResponse.json({ text: 'يرجى كتابة سؤالك وسيجيبك صخر فوراً.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // 1. Try Gemini API with Google Search Grounding first
    if (apiKey) {
      const geminiText = await fetchGeminiAi(apiKey, cleanPrompt, history);
      if (geminiText) {
        return NextResponse.json({ text: geminiText });
      }
    }

    // 2. Try Dynamic Web Search Engine (Wikipedia/Internet) for general non-app questions
    const isAppSpecific = cleanPrompt.includes('عمرة') || cleanPrompt.includes('حج') || cleanPrompt.includes('فندق') || cleanPrompt.includes('باقة') || cleanPrompt.includes('سعر') || cleanPrompt.includes('شروط') || cleanPrompt.includes('طيران') || cleanPrompt.includes('ساوث ستريت');

    if (!isAppSpecific) {
      const webSearchText = await fetchWebSearch(cleanPrompt);
      if (webSearchText) {
        return NextResponse.json({ text: webSearchText });
      }
    }

    // 3. Try Real Free LLM (Pollinations AI) for dynamic real AI answers
    const realAiText = await fetchPollinationsAi(cleanPrompt, history);
    if (realAiText) {
      return NextResponse.json({ text: realAiText });
    }

    // 4. Fallback to Local Knowledge AI Engine
    const fallbackAnswer = getSakhrConditionResponse(cleanPrompt);
    return NextResponse.json({ text: fallbackAnswer });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing error' }, { status: 500 });
  }
}
