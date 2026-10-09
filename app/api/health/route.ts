import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export const dynamic = 'force-dynamic';

/**
 * Liveness for the update script and uptime monitors. Public, so it says only
 * "ok", the app version and when it was deployed — nothing about the data.
 */
function deployInfo(): { version: string; commit?: string; deployedAt?: string } {
  let version = '0.0.0';
  try {
    version = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).version || version;
  } catch {
    /* keep default */
  }
  try {
    const info = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.deploy-info.json'), 'utf8'));
    return { version, commit: String(info.commit || '').slice(0, 7) || undefined, deployedAt: info.deployedAt };
  } catch {
    return { version };
  }
}

export async function GET() {
  const started = Date.now();
  try {
    getSqliteDb().prepare('SELECT 1').get();
    return NextResponse.json(
      { ok: true, ...deployInfo(), uptimeSeconds: Math.round(process.uptime()), dbMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ ok: false, ...deployInfo() }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
