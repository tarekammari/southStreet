import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireStepUp, SUPER_ONLY } from '@/lib/staff-gate';
import { backupFilePath, createBackup, listBackups } from '@/lib/backup';
import { dbLogAudit } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Super Admin only. Listing and creating are routine; downloading hands out a
 * copy of the whole (encrypted) database, so it needs a fresh security-key tap.
 * Restoring is deliberately not offered here: it is a server command (db:restore)
 * run with the app stopped.
 */
export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;

  const name = req.nextUrl.searchParams.get('download');
  if (!name) {
    return NextResponse.json({
      backups: listBackups(),
      keep: Number(process.env.BACKUP_KEEP) || 14,
    });
  }

  const stepUp = requireStepUp(req, gate);
  if (stepUp) return stepUp.error;
  const file = backupFilePath(name);
  if (!file) return NextResponse.json({ error: 'النسخة غير موجودة' }, { status: 404 });
  dbLogAudit(gate.account.name, gate.role, 'تنزيل نسخة احتياطية', name);
  const data = fs.readFileSync(file);
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(data.length),
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  try {
    const backup = await createBackup('manual');
    dbLogAudit(gate.account.name, gate.role, 'إنشاء نسخة احتياطية', backup.name);
    return NextResponse.json({ success: true, backup, message: 'تم إنشاء النسخة الاحتياطية' });
  } catch (error: any) {
    return NextResponse.json({ error: `تعذّر إنشاء النسخة: ${error?.message || 'خطأ'}` }, { status: 500 });
  }
}
