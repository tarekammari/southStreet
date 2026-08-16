import { NextResponse } from 'next/server';
import { AIService } from '@/lib/ai/ai-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = (body.prompt || '').trim();
    const history = body.history || [];

    if (!prompt) {
      return NextResponse.json({
        text: 'يرجى كتابة سؤالك وسيجيبك صخر فوراً.'
      });
    }

    const responsePayload = await AIService.processAgenticRequest(prompt, history);
    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      { error: 'حدث خطأ في معالجة طلب الذكاء الاصطناعي' },
      { status: 500 }
    );
  }
}
