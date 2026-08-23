import { getSqliteDb } from './sqlite';
import { dbLogAudit } from './db';

export type ReviewTargetType = 'agency' | 'staff' | 'package';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';

export interface Review {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  targetName: string;
  reviewerName: string;
  reviewerUserId: string;
  stars: number;
  title: string;
  body: string;
  status: ReviewStatus;
  featured: boolean;
  adminReply: string;
  adminReplyAt: string;
  createdAt: string;
  publishedAt: string;
}

export interface ReviewSummary {
  targetType: ReviewTargetType;
  targetId: string;
  average: number;
  count: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

const AGENCY_ID = 'main';

function mapRow(row: any): Review {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name || '',
    reviewerName: row.reviewer_name,
    reviewerUserId: row.reviewer_user_id || '',
    stars: Number(row.stars) || 0,
    title: row.title || '',
    body: row.body || '',
    status: row.status,
    featured: Boolean(row.featured),
    adminReply: row.admin_reply || '',
    adminReplyAt: row.admin_reply_at || '',
    createdAt: row.created_at,
    publishedAt: row.published_at || '',
  };
}

function clampStars(value: unknown): number {
  const n = Math.round(Number(value));
  return Math.min(5, Math.max(1, Number.isFinite(n) ? n : 5));
}

export function emptyHistogram(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export function computeSummary(targetType: ReviewTargetType, targetId: string): ReviewSummary {
  const db = getSqliteDb();
  const rows = db.prepare(
    `SELECT stars FROM reviews WHERE target_type = ? AND target_id = ? AND status = 'APPROVED'`
  ).all(targetType, targetId) as { stars: number }[];

  const histogram = emptyHistogram();
  let sum = 0;
  for (const row of rows) {
    const stars = clampStars(row.stars);
    histogram[stars as 1 | 2 | 3 | 4 | 5] += 1;
    sum += stars;
  }
  const count = rows.length;
  const average = count ? Math.round((sum / count) * 10) / 10 : 0;
  return { targetType, targetId, average, count, histogram };
}

export function syncStaffRating(staffId: string): ReviewSummary {
  const summary = computeSummary('staff', staffId);
  const db = getSqliteDb();
  const cols = (db.prepare('PRAGMA table_info(morshids)').all() as any[]).map((c) => c.name);
  if (summary.count > 0) {
    if (cols.includes('review_count')) {
      db.prepare('UPDATE morshids SET rating = ?, review_count = ? WHERE morshid_id = ?')
        .run(summary.average, summary.count, staffId);
    } else {
      db.prepare('UPDATE morshids SET rating = ? WHERE morshid_id = ?').run(summary.average, staffId);
    }
  }
  return summary;
}

export function listPublicReviews(opts: {
  targetType?: ReviewTargetType;
  targetId?: string;
  featuredOnly?: boolean;
  limit?: number;
}): Review[] {
  const db = getSqliteDb();
  const limit = Math.min(40, Math.max(1, opts.limit || 12));
  let sql = `SELECT * FROM reviews WHERE status = 'APPROVED'`;
  const params: unknown[] = [];
  if (opts.targetType) {
    sql += ' AND target_type = ?';
    params.push(opts.targetType);
  }
  if (opts.targetId) {
    sql += ' AND target_id = ?';
    params.push(opts.targetId);
  }
  if (opts.featuredOnly) sql += ' AND featured = 1';
  sql += ' ORDER BY featured DESC, created_at DESC LIMIT ?';
  params.push(limit);
  return (db.prepare(sql).all(...params) as any[]).map(mapRow);
}

export function listAdminReviews(status?: ReviewStatus): Review[] {
  const db = getSqliteDb();
  if (status) {
    return (db.prepare('SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC')
      .all(status) as any[]).map(mapRow);
  }
  return (db.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 200').all() as any[]).map(mapRow);
}

export function submitReview(input: {
  targetType: ReviewTargetType;
  targetId: string;
  targetName?: string;
  reviewerName: string;
  reviewerUserId?: string;
  stars: number;
  title?: string;
  body: string;
}): Review {
  const db = getSqliteDb();
  const stars = clampStars(input.stars);
  const name = (input.reviewerName || '').trim();
  const body = (input.body || '').trim();
  if (!name) throw new Error('يرجى كتابة اسمك');
  if (body.length < 12) throw new Error('يرجى كتابة رأي أوضح (12 حرفاً على الأقل)');

  let targetName = input.targetName || '';
  if (input.targetType === 'staff' && !targetName) {
    const staff = db.prepare('SELECT name FROM morshids WHERE morshid_id = ?').get(input.targetId) as any;
    targetName = staff?.name || '';
  }
  if (input.targetType === 'agency') targetName = targetName || 'وكالة ساوث ستريت';

  if (input.reviewerUserId) {
    const existing = db.prepare(
      `SELECT id FROM reviews WHERE reviewer_user_id = ? AND target_type = ? AND target_id = ? AND status IN ('PENDING','APPROVED')`
    ).get(input.reviewerUserId, input.targetType, input.targetId) as any;
    if (existing) {
      db.prepare(
        `UPDATE reviews SET stars = ?, title = ?, body = ?, status = 'PENDING', featured = 0, created_at = ? WHERE id = ?`
      ).run(stars, (input.title || '').trim(), body, new Date().toISOString(), existing.id);
      return mapRow(db.prepare('SELECT * FROM reviews WHERE id = ?').get(existing.id));
    }
  }

  const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO reviews (
      id, target_type, target_id, target_name, reviewer_name, reviewer_user_id,
      stars, title, body, status, featured, admin_reply, admin_reply_at, created_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, '', '', ?, '')
  `).run(
    id,
    input.targetType,
    input.targetId || AGENCY_ID,
    targetName,
    name,
    input.reviewerUserId || '',
    stars,
    (input.title || '').trim(),
    body,
    createdAt
  );

  dbLogAudit(name, 'PILGRIM_USER', 'تقييم جديد بانتظار المراجعة', `${stars}★ — ${targetName}`);
  return mapRow(db.prepare('SELECT * FROM reviews WHERE id = ?').get(id));
}

export function moderateReview(input: {
  id: string;
  status?: ReviewStatus;
  featured?: boolean;
  adminReply?: string;
  actorName?: string;
}): Review {
  const db = getSqliteDb();
  const current = db.prepare('SELECT * FROM reviews WHERE id = ?').get(input.id) as any;
  if (!current) throw new Error('التقييم غير موجود');

  const status = input.status || current.status;
  const featured = input.featured === undefined ? current.featured : (input.featured ? 1 : 0);
  const adminReply = input.adminReply !== undefined ? input.adminReply : (current.admin_reply || '');
  const publishedAt = status === 'APPROVED' ? (current.published_at || new Date().toISOString()) : '';
  const adminReplyAt = input.adminReply !== undefined && input.adminReply.trim()
    ? new Date().toISOString()
    : current.admin_reply_at || '';

  db.prepare(`
    UPDATE reviews SET status = ?, featured = ?, admin_reply = ?, admin_reply_at = ?, published_at = ?
    WHERE id = ?
  `).run(status, featured, adminReply, adminReplyAt, publishedAt, input.id);

  if (current.target_type === 'staff') syncStaffRating(current.target_id);

  dbLogAudit(input.actorName || 'الإدارة', 'SUPER_ADMIN', 'مراجعة تقييم', `${current.id} → ${status}`);
  return mapRow(db.prepare('SELECT * FROM reviews WHERE id = ?').get(input.id));
}

export function agencySummary(): ReviewSummary {
  return computeSummary('agency', AGENCY_ID);
}

export const REVIEW_AGENCY_ID = AGENCY_ID;
