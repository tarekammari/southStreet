import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { saveGoogleClientId } from '@/lib/google-auth-config';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

const READ_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireAgencyAccess(req: NextRequest, _mutating: boolean) {
  return requireRole(req, ADMINS);
}


const __ADMIN_API_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireAdminApi(req: any) {
  return requireRole(req, ADMINS);
}

export async function GET(req: NextRequest) {
  const __gate = requireAdminApi(req);
  if ('error' in __gate) return __gate.error;

  const gate = requireAgencyAccess(req, false);
  if ('error' in gate) return gate.error;
  try {
    const db = getSqliteDb();
    const row = db.prepare("SELECT * FROM agency_settings WHERE id = 'main'").get() as any;
    if (!row) {
      return NextResponse.json({ error: 'البيانات غير موجودة' }, { status: 404 });
    }
    const { google_client_id: _omit, security_key: _key, ...publicRow } = row;
    return NextResponse.json({
      ...publicRow,
      supported_languages: JSON.parse(row.supported_languages || '[]'),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const __gate = requireAdminApi(req);
  if ('error' in __gate) return __gate.error;

  const gate = requireAgencyAccess(req, true);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json();
    const db = getSqliteDb();

    if (body.google_client_id != null && body.agency_name == null) {
      // Google client id is a sensitive admin setting — SUPER_ADMIN only
      if (gate.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      saveGoogleClientId(String(body.google_client_id || ''));
      return NextResponse.json({ success: true, message: 'تم حفظ معرف عميل جوجل. يمكن للأعضاء الإنشاء والدخول بجوجل الآن.' });
    }

    db.prepare(`
      UPDATE agency_settings SET
        agency_name = ?,
        legal_name = ?,
        logo = ?,
        description = ?,
        address = ?,
        city = ?,
        country = ?,
        phone = ?,
        whatsapp = ?,
        email = ?,
        website = ?,
        opening_hours = ?,
        emergency_phone = ?,
        supported_languages = ?,
        default_currency = ?,
        timezone = ?,
        google_client_id = ?
      WHERE id = 'main'
    `).run(
      body.agency_name,
      body.legal_name,
      body.logo,
      body.description,
      body.address,
      body.city,
      body.country,
      body.phone,
      body.whatsapp,
      body.email,
      body.website,
      body.opening_hours,
      body.emergency_phone,
      JSON.stringify(body.supported_languages || []),
      body.default_currency || 'DZD',
      body.timezone || 'Africa/Algiers',
      (body.google_client_id || '').trim()
    );

    return NextResponse.json({ success: true, message: 'تم تحديث بيانات الوكالة بنجاح في قاعدة البيانات' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
