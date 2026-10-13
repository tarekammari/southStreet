import { NextResponse } from 'next/server';
import { requireRole, ADMINS } from '@/lib/staff-gate';
import { dbLogAudit } from '@/lib/db';
import { listGuidePrograms, setGuidePrograms } from '@/lib/guide-programs';

export const dynamic = 'force-dynamic';

/**
 * The programmes a guide accompanies (lib/guide-programs.ts). Managers only.
 *   GET ?id=<morshid_id>            programmes, with who guides each one
 *   PUT {id, package_ids: string[]} this guide accompanies exactly these programmes
 */
export async function GET(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const { guide, programs } = listGuidePrograms(new URL(req.url).searchParams.get('id') || '');
  if (!guide) return NextResponse.json({ error: 'المرشد غير موجود' }, { status: 404 });
  return NextResponse.json({ programs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  const result = setGuidePrograms(id, Array.isArray(body.package_ids) ? body.package_ids : []);
  if (!result) return NextResponse.json({ error: 'المرشد غير موجود' }, { status: 404 });
  const { guide, programs } = listGuidePrograms(id);
  if (result.added.length || result.removed.length) {
    const parts = [result.added.length ? `أُسند: ${result.added.join('، ')}` : '', result.removed.length ? `أُزيل: ${result.removed.join('، ')}` : ''].filter(Boolean);
    dbLogAudit(gate.account.name, gate.role, 'برامج المرشد', `${guide?.name} — ${parts.join(' | ')}`);
  }
  return NextResponse.json({ success: true, added: result.added.length, removed: result.removed.length, programs });
}
