import fs from 'fs';
import path from 'path';
import { generateNewSecurityKey } from '@/lib/security';
import { getDatabase, saveDatabase, dbLogAudit } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';

export type AdminKeyMeta = {
  fingerprint: string;
  issuedAt: string | null;
};

function fingerprintOf(key: string): string {
  const clean = String(key || '').trim();
  if (!clean) return '';
  return clean.slice(-4);
}

export function getAdminKeyMeta(): AdminKeyMeta {
  try {
    const row = getSqliteDb()
      .prepare("SELECT security_key, security_key_issued_at FROM agency_settings WHERE id = 'main'")
      .get() as { security_key?: string; security_key_issued_at?: string } | undefined;
    const key = row?.security_key || getDatabase().securityKey || '';
    return {
      fingerprint: fingerprintOf(key),
      issuedAt: row?.security_key_issued_at || null,
    };
  } catch {
    try {
      return { fingerprint: fingerprintOf(getDatabase().securityKey || ''), issuedAt: null };
    } catch {
      return { fingerprint: '', issuedAt: null };
    }
  }
}

export function rotateAdminSecurityKey(actorName: string, ip = '') {
  const { keyString, fileContent } = generateNewSecurityKey();
  const issuedAt = new Date().toISOString();

  const db = getDatabase();
  db.securityKey = keyString;
  saveDatabase(db);

  try {
    const sqlite = getSqliteDb();
    sqlite
      .prepare("UPDATE agency_settings SET security_key = ?, security_key_issued_at = ? WHERE id = 'main'")
      .run(keyString, issuedAt);
  } catch {
    /* column may still be migrating */
  }

  try {
    fs.writeFileSync(path.join(process.cwd(), 'southstreet_admin.key'), fileContent, 'utf8');
  } catch {
    /* download still works even if disk write fails */
  }

  try {
    dbLogAudit(actorName || 'الإدارة', 'SUPER_ADMIN', 'توليد مفتاح أمان جديد', 'تم إبطال المفتاح السابق فوراً', ip);
  } catch {
    /* audit is optional */
  }

  return {
    fileName: 'southstreet_admin.key',
    fileContent,
    fingerprint: fingerprintOf(keyString),
    issuedAt,
  };
}
