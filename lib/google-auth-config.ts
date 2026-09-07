import { PUBLIC_GOOGLE_WEB_CLIENT_ID } from './google-web-client';
import { getSqliteDb } from './sqlite';

function fromEnv(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
}

export function isGoogleClientId(value: string): boolean {
  const id = value.trim();
  return id.length > 20 && id.includes('.apps.googleusercontent.com');
}

export function getGoogleClientId(): string {
  try {
    const row = getSqliteDb()
      .prepare("SELECT google_client_id FROM agency_settings WHERE id = 'main'")
      .get() as { google_client_id?: string } | undefined;
    const fromDb = String(row?.google_client_id || '').trim();
    if (fromDb) return fromDb;
  } catch {
    /* fall through to env */
  }
  return fromEnv() || PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

export function saveGoogleClientId(clientId: string): string {
  const id = clientId.trim();
  const db = getSqliteDb();
  const updated = db.prepare("UPDATE agency_settings SET google_client_id = ? WHERE id = 'main'").run(id);
  if (updated.changes === 0) {
    db.prepare("INSERT INTO agency_settings (id, google_client_id) VALUES ('main', ?)").run(id);
  }
  return id;
}
