import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { dbLogAudit } from '@/lib/db';
import { normalizeLoginRole } from '@/lib/roles';
import {
  deleteRule,
  getFirewallSettings,
  listRules,
  setRuleStatus,
  updateFirewallSettings,
  upsertRule,
} from '@/lib/security-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) return null;
  const role = normalizeLoginRole(String(payload.role || ''), {
    email: payload.email,
    roleName: payload.roleName,
  });
  if (!ADMIN_ROLES.has(role)) return null;
  return payload;
}

function audit(actor: string, role: string, action: string, details: string) {
  try {
    dbLogAudit(actor, role, action, details);
  } catch {
    /* the firewall change still applies if the audit table is unavailable */
  }
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '');
  const actor = admin.name || 'admin';
  const role = String(admin.role || 'admin');

  switch (action) {
    case 'block': {
      const rules = upsertRule({ ip: body.ip, type: 'BLOCK', note: body.note || 'حظر يدوي من لوحة الأمان', createdBy: actor });
      audit(actor, role, 'حظر عنوان IP', `ip=${body.ip}`);
      return NextResponse.json({ ok: true, message: `تم حظر ${body.ip}`, rules });
    }
    case 'allow': {
      const rules = upsertRule({ ip: body.ip, type: 'ALLOW', note: body.note || 'عنوان موثوق', createdBy: actor });
      audit(actor, role, 'اعتماد عنوان IP موثوق', `ip=${body.ip}`);
      return NextResponse.json({ ok: true, message: `تم اعتماد ${body.ip} كعنوان موثوق`, rules });
    }
    case 'toggle': {
      const rules = setRuleStatus(String(body.id), Boolean(body.active));
      return NextResponse.json({ ok: true, message: 'تم تحديث القاعدة', rules });
    }
    case 'remove': {
      const rules = deleteRule(String(body.id));
      audit(actor, role, 'حذف قاعدة جدار حماية', `id=${body.id}`);
      return NextResponse.json({ ok: true, message: 'تم حذف القاعدة', rules });
    }
    case 'settings': {
      const settings = updateFirewallSettings({
        enabled: body.enabled,
        blockBots: body.blockBots,
        blockScanners: body.blockScanners,
        blockInjection: body.blockInjection,
        floodLimit: body.floodLimit,
      });
      audit(actor, role, 'تعديل إعدادات جدار الحماية', JSON.stringify(settings));
      return NextResponse.json({ ok: true, message: 'تم حفظ إعدادات الجدار الناري', settings });
    }
    default:
      return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });
  return NextResponse.json({ rules: listRules(), settings: getFirewallSettings() });
}
