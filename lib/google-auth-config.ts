import { getSqliteDb } from './sqlite';

export function getGoogleClientId(): string {
  const fromEnv = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const row = getSqliteDb()
      .prepare("SELECT google_client_id FROM agency_settings WHERE id = 'main'")
      .get() as { google_client_id?: string } | undefined;
    return String(row?.google_client_id || '').trim();
  } catch {
    return '';
  }
}

export function saveGoogleClientId(clientId: string): void {
  const db = getSqliteDb();
  db.prepare("UPDATE agency_settings SET google_client_id = ? WHERE id = 'main'").run(clientId.trim());
}
