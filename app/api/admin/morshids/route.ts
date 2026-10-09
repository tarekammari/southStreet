import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { requireRole, ADMINS } from '@/lib/staff-gate';
import { inspectDelete, disableStaffLogin } from '@/lib/admin-delete-guards';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseLanguages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const db = getSqliteDb();
    // Admins get the full row; the public catalogue never receives phone numbers.
    const isAdmin = !('error' in requireRole(req, ADMINS));
    const rows = db.prepare('SELECT * FROM morshids ORDER BY rowid ASC').all() as any[];
    const morshids = rows.map(m => {
      const languages = parseLanguages(m.languages);
      const { phone, ...publicFields } = m;
      return { ...(isAdmin ? m : publicFields), languages, reviewCount: Number(m.review_count) || 0 };
    });
    return NextResponse.json(morshids, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Writes are Admin-only (reads stay public for the catalog pages).
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json();
    const db = getSqliteDb();

    const morshid_id = body.morshid_id || `msh_${Date.now()}`;
    const { isEmailTaken } = require('@/lib/accounts') as typeof import('@/lib/accounts');
    if (!body.morshid_id && typeof body.email === 'string' && body.email.trim() && isEmailTaken(body.email)) {
      return NextResponse.json({ error: 'هذا البريد الإلكتروني مستعمل لحساب آخر' }, { status: 409 });
    }

    db.prepare(`
      INSERT INTO morshids (
        morshid_id, name, roleName, specialization, experience_years, languages, phone, avatar, rating, status, category, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(morshid_id) DO UPDATE SET
        name = excluded.name,
        roleName = excluded.roleName,
        specialization = excluded.specialization,
        experience_years = excluded.experience_years,
        languages = excluded.languages,
        phone = excluded.phone,
        avatar = excluded.avatar,
        rating = excluded.rating,
        status = excluded.status,
        category = excluded.category,
        image = excluded.image
    `    ).run(
      morshid_id,
      body.name,
      body.roleName,
      body.specialization,
      body.experience_years || 5,
      JSON.stringify(body.languages || ['العربية']),
      body.phone,
      body.avatar || (body.name ? body.name.charAt(0) : 'م'),
      body.rating || 4.9,
      body.status || 'متاح',
      body.category || 'religious_guide',
      // No stock portrait: members without a photo show their initials everywhere.
      body.image || ''
    );

    const { ensureStaffLogin } = require('@/lib/accounts') as typeof import('@/lib/accounts');
    const credentials = ensureStaffLogin({
      morshid_id,
      name: body.name,
      roleName: body.roleName,
      category: body.category,
      status: body.status,
      phone: body.phone,
      email: typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : undefined,
      username: typeof body.username === 'string' ? body.username.trim().slice(0, 60) : undefined,
    });

    return NextResponse.json({
      success: true,
      morshid_id,
      message: 'تم حفظ العضو وإصدار حساب الدخول (اسم مستخدم، كلمة مرور، QR)',
      credentials: credentials.created || credentials.password ? {
        username: credentials.username,
        password: credentials.password,
        qrPayload: credentials.qrPayload,
        role: credentials.role,
      } : { username: credentials.username, role: credentials.role },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Columns a staff profile edit may change; anything else in the body is ignored. */
const EDITABLE = ['name', 'roleName', 'specialization', 'experience_years', 'languages', 'phone', 'category', 'image', 'rating'] as const;
const CATEGORIES = new Set(['staff', 'religious_guide', 'women_guide', 'field_guide', 'accountant']);

export async function PATCH(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.morshid_id || '');
    const db = getSqliteDb();
    const row = id ? (db.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(id) as any) : null;
    if (!row) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });

    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      let value: unknown = body[key];
      if (key === 'name') {
        value = String(value || '').trim().slice(0, 120);
        if (!value) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
      } else if (key === 'category') {
        if (!CATEGORIES.has(String(value))) return NextResponse.json({ error: 'نوع العضو غير صالح' }, { status: 400 });
      } else if (key === 'languages') {
        value = JSON.stringify(Array.isArray(value) ? value.map(String).slice(0, 12) : []);
      } else if (key === 'experience_years' || key === 'rating') {
        const n = Number(value);
        value = Number.isFinite(n) ? n : null;
      } else {
        value = String(value ?? '').trim().slice(0, key === 'image' ? 500 : 200);
      }
      patch[key] = value;
    }
    const keys = Object.keys(patch);
    if (keys.length === 0) return NextResponse.json({ error: 'لا يوجد تحديث' }, { status: 400 });

    db.prepare(`UPDATE morshids SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE morshid_id = ?`).run(...keys.map((k) => patch[k]), id);
    const updated = db.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(id) as any;

    // Name, phone and type (→ login role) follow the profile; the password is untouched.
    const { ensureStaffLogin } = require('@/lib/accounts') as typeof import('@/lib/accounts');
    try {
      ensureStaffLogin(updated);
    } catch (err: any) {
      if (err?.message !== 'PRIVILEGED_PROTECTED' && err?.message !== 'SUPER_ADMIN_PROTECTED') throw err;
    }
    return NextResponse.json({ success: true, message: 'تم حفظ الملف' });
  } catch (error: any) {
    const msg = String(error?.message || '');
    return NextResponse.json({ error: /[\u0600-\u06FF]/.test(msg) ? msg : 'تعذّر حفظ الملف' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  // Writes are Admin-only (reads stay public for the catalog pages).
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });

    const db = getSqliteDb();
    const row = db.prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(id) as any;
    if (!row) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });

    // Same rules as the Tables panel: no deleting a guide who still has packages or salary records.
    const { blocker } = inspectDelete(db, 'morshids', row);
    if (blocker) return NextResponse.json({ error: blocker, code: 'DELETE_BLOCKED' }, { status: 409 });

    db.prepare('DELETE FROM morshids WHERE morshid_id = ?').run(id);
    disableStaffLogin(db, id);

    return NextResponse.json({ success: true, message: 'تم حذف العضو بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
