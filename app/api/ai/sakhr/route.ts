import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s max timeout for fast response

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `أنت "صخر"، المساعد الذكي لوكالة "سوث ستريت" للرحلات وعروض العمرة والحج بالجزائر. أجب بلغة عربية فصيحة، مبسطة، طبيعية وواضحة جداً في جملتين قصائرتين تناسب النطق الصوتي المباشر بدون رموز أو تعقيدات.

سؤال المستخدم: ${prompt}`
                    }
                  ]
                }
              ]
            })
          }
        );
        clearTimeout(timeoutId);

        const data = await response.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) {
          return NextResponse.json({ text: answer.trim() });
        }
      } catch (e) {
        // Timeout or network fallback
      }
    }

    // Fast context-aware responses
    let fallbackAnswer = 'أهلاً بك مع صخر المساعد الذكي لوكالة سوث ستريت. نوفر لك أفضل عروض العمرة والحج، والطيران المباشر، والإقامة الفاخرة بجوار صحن الحرم المكي الشريف.';

    if (prompt.includes('أوت') || prompt.includes('شهر')) {
      fallbackAnswer = 'يُوصي صخر بباقتين متميزتين لشهر أوت: عمرة 10 أوت بفندق منارات غزة، وعمرة المولد النبوي بسويس أوتيل بجوار صحن الحرم.';
    } else if (prompt.includes('فندق') || prompt.includes('الحرم') || prompt.includes('قريب')) {
      fallbackAnswer = 'جميع عروض سوث ستريت توفر إقامة فاخرة على بعد خمسين متراً إلى ستمائة متر فقط عن صحن الحرم المكي الشريف.';
    } else if (prompt.includes('مباشر') || prompt.includes('الجزائر') || prompt.includes('طيران')) {
      fallbackAnswer = 'يتوفر طيران مباشر مريح عبر الخطوط الجوية الجزائرية والخطوط السعودية من مطارات الجزائر، وهران، وعنابة.';
    }

    return NextResponse.json({ text: fallbackAnswer });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing error' }, { status: 500 });
  }
}
