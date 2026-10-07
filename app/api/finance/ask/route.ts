import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import {
  FAMOUS_QUESTIONS,
  answerFinanceQuestion,
  financeBrief,
  type FinancePeriodId,
} from '@/lib/finance-ai';

export const dynamic = 'force-dynamic';

const PERIODS: FinancePeriodId[] = ['month', 'quarter', 'year', 'all'];

function period(raw: string | null): FinancePeriodId {
  const v = String(raw || '').toLowerCase() as FinancePeriodId;
  return PERIODS.includes(v) ? v : 'month';
}

/** Suggested questions plus a live brief, so the panel opens with real figures. */
export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  return NextResponse.json({
    questions: FAMOUS_QUESTIONS,
    brief: financeBrief(period(searchParams.get('period'))),
  });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const question = String(body.question || '').trim();
    if (!question) return NextResponse.json({ error: 'اكتب سؤالاً' }, { status: 400 });
    return NextResponse.json(
      answerFinanceQuestion({
        question,
        period: period(body.period),
        tripType: body.trip_type || null,
      })
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذّر تحليل السؤال' }, { status: 500 });
  }
}
