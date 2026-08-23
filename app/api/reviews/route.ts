import { NextRequest, NextResponse } from 'next/server';
import {
  agencySummary,
  computeSummary,
  listPublicReviews,
  submitReview,
  ReviewTargetType,
} from '@/lib/reviews';
import { getAuthUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = (searchParams.get('targetType') || 'agency') as ReviewTargetType;
    const targetId = searchParams.get('targetId') || 'main';
    const featuredOnly = searchParams.get('featured') === '1';
    const reviews = listPublicReviews({
      targetType,
      targetId,
      featuredOnly,
      limit: Number(searchParams.get('limit') || 12),
    });
    const summary = targetType === 'agency' && targetId === 'main'
      ? agencySummary()
      : computeSummary(targetType, targetId);
    return NextResponse.json({ summary, reviews });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب التقييمات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body = await req.json();
    const review = submitReview({
      targetType: body.targetType || 'agency',
      targetId: body.targetId || 'main',
      targetName: body.targetName,
      reviewerName: body.reviewerName || auth?.name || '',
      reviewerUserId: auth?.id || body.reviewerUserId,
      stars: body.stars,
      title: body.title,
      body: body.body,
    });
    return NextResponse.json({
      success: true,
      review: { ...review, status: 'PENDING' },
      message: 'شكراً لتقييمك. سيظهر بعد مراجعة الإدارة — مثل تطبيقات التقييم المعتمدة.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إرسال التقييم' }, { status: 400 });
  }
}
