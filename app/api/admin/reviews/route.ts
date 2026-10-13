import { after, NextRequest, NextResponse } from 'next/server';
import { alertUser } from '@/lib/staff-alerts';
import { listAdminReviews, moderateReview, ReviewStatus } from '@/lib/reviews';
import { getSqliteDb } from '@/lib/sqlite';
import { getAuthUser } from '@/lib/request-auth';
import { requireRole, ADMINS } from '@/lib/staff-gate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
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
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'معرّف التقييم مطلوب' }, { status: 400 });
    const before = getSqliteDb().prepare('SELECT status FROM reviews WHERE id = ?').get(body.id) as { status?: string } | undefined;
    const review = moderateReview({
      id: body.id,
      status: body.status,
      featured: body.featured,
      adminReply: body.adminReply,
      actorName: gate.account.name || 'الإدارة',
    });
    // Thank the client when the testimonial goes live.
    if (review.status === 'APPROVED' && before?.status !== 'APPROVED' && review.reviewerUserId) {
      after(() =>
        alertUser(review.reviewerUserId, {
          title: 'شكراً لك! نُشر تقييمك',
          body: 'أصبح تقييمك ظاهراً في موقع الوكالة.',
          url: '/',
          tag: `review-${review.id}`,
        })
      );
    }
    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر تحديث التقييم' }, { status: 400 });
  }
}
