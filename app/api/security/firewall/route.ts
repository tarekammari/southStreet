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
  updateRule,
  upsertRule,
} from '@/lib/security-monitor';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN']);

function requireAdmin(req: NextRequest) {
  return requireRole(req, SUPER_ONLY);
}

function audit(actor: string, role: string, action: string, details: string) {
  try {
    dbLogAudit(actor, role, action, details);
  } catch {
    /* the firewall change still applies if the audit table is unavailable */
  }
}

export async function POST(req: NextRequest) {
  const gate = requireAdmin(req);
  if ('error' in gate) return gate.error;
  const admin = gate.payload;

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
    case 'update': {
      const rules = updateRule({
        id: String(body.id || ''),
        ip: body.ip,
        type: body.type === 'ALLOW' ? 'ALLOW' : body.type === 'BLOCK' ? 'BLOCK' : undefined,
        note: body.note,
        active: body.active,
      });
      audit(actor, role, 'تعديل قاعدة جدار حماية', `id=${body.id}`);
      return NextResponse.json({ ok: true, message: 'تم تحديث القاعدة', rules });
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
        blockXss: body.blockXss,
        blockExploits: body.blockExploits,
        autoBan: body.autoBan,
        autoBanHits: body.autoBanHits,
        listenAll: body.listenAll,
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
  const gate = requireAdmin(req);
  if ('error' in gate) return gate.error;
  return NextResponse.json({ rules: listRules(), settings: getFirewallSettings() });
}
