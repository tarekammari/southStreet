import { NextRequest, NextResponse } from 'next/server';
import { listAdminReviews, moderateReview, ReviewStatus } from '@/lib/reviews';
import { getAuthUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const status = (new URL(req.url).searchParams.get('status') || '') as ReviewStatus | '';
    const reviews = listAdminReviews(status || undefined);
    const pending = reviews.filter((r) => r.status === 'PENDING').length;
    return NextResponse.json({ reviews, pending });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب التقييمات' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'معرّف التقييم مطلوب' }, { status: 400 });
    const review = moderateReview({
      id: body.id,
      status: body.status,
      featured: body.featured,
      adminReply: body.adminReply,
      actorName: auth?.name || 'الإدارة',
    });
    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر تحديث التقييم' }, { status: 400 });
  }
}
