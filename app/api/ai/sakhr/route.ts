import { NextResponse } from 'next/server';

/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  SAKHR AI — n8n WEBHOOK PROXY                               │
 * │  Connects the Next.js chat widget to your n8n AI workflow   │
 * └─────────────────────────────────────────────────────────────┘
 */
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

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    // If n8n webhook URL is configured, forward the request to n8n
    if (n8nWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

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
          // Support various n8n response formats
          const text = data.text || data.output || data.response || (typeof data === 'string' ? data : 'تمت معالجة الطلب بنجاح.');
          return NextResponse.json({
            text,
            cards: data.cards || [],
            actions: data.actions || [],
            media: data.media || []
          });
        } else {
          console.warn(`[n8n Webhook] Returned status ${res.status}`);
        }
      } catch (err: any) {
        console.error('[n8n Webhook] Error calling workflow:', err?.message);
      }
    }

    // Default response when n8n webhook is not yet connected
    return NextResponse.json({
      text: `أهلاً بك! صخر المساعد الذكي لوكالة ساوث ستريت 🕋\n\n📌 **جاهز للربط مع n8n:**\nيرجى تعيين \`N8N_WEBHOOK_URL\` في ملف \`.env\` لتفعيل سير العمل الخاص بـ n8n.`,
      cards: []
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'حدث خطأ في معالجة طلب الذكاء الاصطناعي' },
      { status: 500 }
    );
  }
}
