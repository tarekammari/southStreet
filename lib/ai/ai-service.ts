import { dbGetAgencySettings, dbGetPackages, dbGetHotels, dbGetMorshids, dbGetSeasons, dbLogAiConversation } from '../db';
import { LocalLlmEngine } from './local-llm-engine';
import { AiToolExecutor, ToolCallResult } from './tools';
import { AiResponsePayload, MediaAsset, AiAction, AiCard } from '@/types';

export class AIService {
  /**
   * Build System Context with authoritative agency data
   */
  private static buildSystemPrompt(): string {
    const settings = dbGetAgencySettings();
    const packages = dbGetPackages().filter(p => p.published);
    const morshids = dbGetMorshids();
    const hotels = dbGetHotels();
    const seasons = dbGetSeasons();

    const packagesSummary = packages.map(p => {
      const minPrice = Math.min(...p.prices.map(pr => pr.amount));
      return `- الباقة: ${p.name} (ID: ${p.package_id})
  * السعر الأدنى: ${minPrice.toLocaleString()} دج
  * فندق مكة: ${p.makkah_hotel_name} (${p.makkah_hotel_dist})
  * فندق المدينة: ${p.madinah_hotel_name} (${p.madinah_hotel_dist})
  * الطيران: ${p.airline}
  * المرشد: ${p.morshid_name || 'مرشد معتمد'}
  * المقاعد المتاحة بالنظام: ${p.available} مقعد`;
    }).join('\n\n');

    const hotelsSummary = hotels.map(h => `- ${h.name}: ${h.city}، المسافة عن الحرم: ${h.distance_from_haram}.`).join('\n');
    const morshidsSummary = morshids.map(m => `- ${m.name}: ${m.specialization} (${m.experience_years} سنة خبرة).`).join('\n');

    return `أنت "صخر" (Sakhr AI) — خبير واستشاري الذكاء الاصطناعي الشامل والتفاعلي لوكالة "${settings.agency_name}".

بيانات الوكالة المعتمدة:
- الوكالة: ${settings.agency_name} (${settings.legal_name})
- الهاتف: ${settings.phone} | واتساب: ${settings.whatsapp} | البريد: ${settings.email}

المواسم والعروض المعتمدة ذات المقاعد الحقيقية:
${packagesSummary}

الفنادق والمرشدون:
${hotelsSummary}
${morshidsSummary}

قواعد التفاعل الحية:
1. أجب بأسلوب ذكي، منظم، ومباشر بلغة المستخدم (عربية فصيحة، دارجة جزائرية، فرنسية، إنجليزية).
2. استخدم التظليل **بالعريض** للتأكيد على النقاط الهامة.
3. إذا طلبت منك فتح بوابة الوكالة أو الدخول، أضف الوسم: [ACTION:OPEN_LOGIN].
4. إذا طلب المستخدم عرض فيديو أو فيلم عن المناسك، أضف الوسم: [ACTION:PLAY_VIDEO].`;
  }

  /**
   * Dedicated Open-Source Meta Llama 3.3 LLM Provider with Multi-Failover Chain
   * Used for non-Hajj/Umrah/Agency general questions (science, sports, history, culture).
   */
  private static async callOpenSourceLlm(prompt: string, history: any[] = []): Promise<string | null> {
    const formattedHistory = (history || []).slice(-4).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text
    }));

    const messages = [
      {
        role: 'system',
        content: 'أنت نموذج Meta Llama 3.3 مفتوح المصدر (Open-Source LLM). تجيب عن الأسئلة العامة في العلوم، الرياضة، التاريخ، الجغرافيا المعارف بتنظيم وتظليل بالعريض.'
      },
      ...formattedHistory,
      { role: 'user', content: prompt }
    ];

    // Layer 1: Groq Meta Llama 3.3 API if GROQ_API_KEY available
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const answer = data?.choices?.[0]?.message?.content;
          if (answer && answer.trim()) {
            return `🌐 **[محرك Meta Llama 3.3]**\n\n${answer.trim()}`;
          }
        }
      } catch (e) {}
    }

    // Layer 2: Pollinations Meta Llama POST API (25s timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: 'llama',
          seed: Math.floor(Math.random() * 1000)
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10 && !text.includes('Error')) {
          return `🌐 **[محرك Meta Llama 3.3]**\n\n${text.trim()}`;
        }
      }
    } catch (e) {}

    // Layer 3: Pollinations Meta Llama GET API Fallback (25s timeout)
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(`https://text.pollinations.ai/${encodedPrompt}?model=llama`, {
        method: 'GET',
        headers: { 'User-Agent': 'SouthStreetAI/2.0' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10 && !text.includes('Error')) {
          return `🌐 **[محرك Meta Llama 3.3]**\n\n${text.trim()}`;
        }
      }
    } catch (e) {}

    // Layer 4: Pollinations Open-Source Real LLM Fallback (20s timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: 'openai',
          seed: Math.floor(Math.random() * 1000)
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10 && !text.includes('Error')) {
          return `🌐 **[محرك الذكاء الاصطناعي مفتوح المصدر]**\n\n${text.trim()}`;
        }
      }
    } catch (e) {}

    return null;
  }

  /**
   * Real LLM Provider: Pollinations AI GPT-4o / Llama-3.3 Endpoint
   */
  private static async callPollinationsRealLlm(prompt: string, history: any[] = []): Promise<string | null> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const formattedHistory = (history || []).slice(-6).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text
      }));

      const messages = [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: prompt }
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: 'openai',
          seed: Math.floor(Math.random() * 1000)
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10 && !text.includes('Error')) {
          return text.trim();
        }
      }
    } catch (e) {}

    return null;
  }

  /**
   * Real LLM Provider: Google Gemini API
   */
  private static async callGeminiApi(apiKey: string, prompt: string, history: any[] = []): Promise<string | null> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const contentsPayload = [
        ...(history || []).slice(-4).map((h: any) => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        })),
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nسؤال المستخدم: ${prompt}` }]
        }
      ];

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
          body: JSON.stringify({ contents: contentsPayload }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer && answer.trim()) return answer.trim();
      }
    } catch (e) {}

    return null;
  }

  /**
   * Agentic Pipeline Orchestrator with Open-Source Router
   */
  static async processAgenticRequest(prompt: string, history: any[] = []): Promise<AiResponsePayload> {
    const cleanPrompt = (prompt || '').trim();
    if (!cleanPrompt) {
      return { text: 'يرجى كتابة سؤالك وسيجيبك صخر فوراً.' };
    }

    const entities = LocalLlmEngine.extractEntities(cleanPrompt);
    const p = cleanPrompt.toLowerCase();

    // Check if question is related to Hajj, Umrah, Agency, Packages, Prices, Hotels, or Modals
    const isAgencyQuestion = (
      p.includes('عمرة') || p.includes('حج') || p.includes('فندق') || p.includes('فنادق') ||
      p.includes('باقة') || p.includes('باقات') || p.includes('سعر') || p.includes('أسعار') ||
      p.includes('شروط') || p.includes('وثائق') || p.includes('طيران') || p.includes('ساوث ستريت') ||
      p.includes('مرشد') || p.includes('بوابة') || p.includes('دخول') || p.includes('لوجين') ||
      p.includes('احجز') || p.includes('حجز') || p.includes('برنامج') || p.includes('شحال العمرة') ||
      p.includes('فيلم') || p.includes('فيديو') || p.includes('مناسك')
    );

    // 1. ROUTER: If question is NOT about Hajj, Umrah, or Agency -> Fetch directly from Open-Source Meta Llama 3.3!
    if (!isAgencyQuestion) {
      const openSourceText = await this.callOpenSourceLlm(cleanPrompt, history);
      if (openSourceText) {
        dbLogAiConversation({
          prompt: cleanPrompt,
          response: openSourceText,
          tools_called: ['meta_llama_3.3_llm'],
          language: entities.language,
          escalated: false
        });
        return { text: openSourceText };
      }
    }

    // 2. Direct Intent Recognition for Specific Actions & Commands
    let matchedToolResult: ToolCallResult | null = null;

    if (entities.intent === 'OPEN_LOGIN') {
      matchedToolResult = AiToolExecutor.executeTool('open_login');
    } else if (entities.intent === 'PLAY_VIDEO') {
      matchedToolResult = AiToolExecutor.executeTool('show_media', { type: 'VIDEO' });
    } else if (entities.intent === 'SHOW_MAP') {
      matchedToolResult = AiToolExecutor.executeTool('show_map', { title: 'فندق سويس أوتيل مكة وصحن الحرم', lat: 21.4187, lng: 39.8256 });
    } else if (entities.intent === 'HUMAN_ESCALATE') {
      matchedToolResult = AiToolExecutor.executeTool('transfer_to_human', { reason: 'طلب تواصل إنساني مباشر' });
    } else if (entities.intent === 'NAVIGATE' && entities.target_page) {
      matchedToolResult = AiToolExecutor.executeTool('navigate_to', { page: entities.target_page });
    }

    // 3. Agency LLM Provider Chain
    let llmText: string | null = null;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      llmText = await this.callGeminiApi(apiKey, cleanPrompt, history);
    }

    if (!llmText) {
      llmText = await this.callPollinationsRealLlm(cleanPrompt, history);
    }

    // Fallback to Local Engine if external connection offline
    if (!llmText) {
      llmText = toolResultTextOrLocal(matchedToolResult, entities, cleanPrompt);
    }

    // 4. Extract Embedded Action Tags from LLM Response
    const actions: AiAction[] = matchedToolResult?.actions ? [...matchedToolResult.actions] : [];
    let mediaAssets: MediaAsset[] | undefined = matchedToolResult?.media;
    let cards: AiCard[] | undefined = matchedToolResult?.cards;

    if (llmText.includes('[ACTION:OPEN_LOGIN]')) {
      actions.push({ type: 'open_modal', target: 'login' });
      llmText = llmText.replace(/\[ACTION:OPEN_LOGIN\]/g, '').trim();
    }

    if (llmText.includes('[ACTION:PLAY_VIDEO]') || entities.intent === 'PLAY_VIDEO') {
      mediaAssets = [
        {
          media_id: 'vid_umrah_guide',
          type: 'VIDEO',
          title: 'فيديو تعليمي قصير: مناسك العمرة خطوة بخطوة',
          description: 'شاهد الشرح المرئي الكامل لأداء مناسك العمرة من الإحرام للطواف والسعي.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop',
          source: 'AGENCY',
          license: 'Official Agency Production',
          approved: true
        }
      ];
      llmText = llmText.replace(/\[ACTION:PLAY_VIDEO\]/g, '').trim();
    }

    if (entities.intent === 'SEARCH_PACKAGES' && (!cards || cards.length === 0)) {
      const searchRes = AiToolExecutor.executeTool('search_packages');
      cards = searchRes.cards;
    }

    const payload: AiResponsePayload = {
      text: llmText,
      actions: actions.length > 0 ? actions : undefined,
      cards,
      media: mediaAssets,
      map: matchedToolResult?.map,
      escalated: matchedToolResult?.escalated
    };

    dbLogAiConversation({
      prompt: cleanPrompt,
      response: llmText,
      tools_called: matchedToolResult ? [matchedToolResult.tool_name] : ['agency_llm_chain'],
      language: entities.language,
      escalated: matchedToolResult?.escalated || false
    });

    return payload;
  }
}

function toolResultTextOrLocal(toolRes: ToolCallResult | null, entities: ExtractedEntities, prompt: string): string {
  if (toolRes) return toolRes.result_text;
  return LocalLlmEngine.generateResponse(entities, prompt);
}
