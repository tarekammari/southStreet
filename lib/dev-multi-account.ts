/**
 * TEMP TEST ONLY — remove when the owner asks to disable multi-account testing.
 * Allows tarekammari1@gmail.com to create many pilgrim personas:
 * same email + different phone (+ name) => new user.
 */
import { getSqliteDb } from './sqlite';
import { lookupHash } from './db-crypto';

/** Flip to false (or delete usages) when testing is done. */
export const DEV_MULTI_ACCOUNT_ENABLED = true;

export const DEV_MULTI_ACCOUNT_EMAIL = 'tarekammari1@gmail.com';

export function isDevMultiAccountEmail(email?: string | null): boolean {
  if (!DEV_MULTI_ACCOUNT_ENABLED) return false;
  return String(email || '').trim().toLowerCase() === DEV_MULTI_ACCOUNT_EMAIL;
}

export function normalizeDevPhone(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '');
}

export function normalizeDevName(name?: string | null): string {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Unique emailHash so UNIQUE(emailHash) allows many rows with the same display email. */
export function devMultiAccountEmailHash(email: string, name?: string | null, phone?: string | null): string {
  const e = String(email || '').trim().toLowerCase();
  const p = normalizeDevPhone(phone) || 'nophone';
  const n = normalizeDevName(name) || 'noname';
  return lookupHash(`${e}::${p}::${n}`);
}

/**
 * Find an existing persona for the test email.
 * Same email + same phone (+ same name) => same user; otherwise treat as new.
 */
export function findDevMultiAccountPersona(input: {
  email: string;
  name?: string | null;
  phone?: string | null;
}): any | null {
  if (!isDevMultiAccountEmail(input.email)) return null;
  const phone = normalizeDevPhone(input.phone);
  const name = normalizeDevName(input.name);
  if (!phone) return null;

  const db = getSqliteDb();
  const users = db.prepare('SELECT * FROM users').all() as any[];
  return (
    users.find((u) => {
      if (String(u.email || '').trim().toLowerCase() !== DEV_MULTI_ACCOUNT_EMAIL) return false;
      if (normalizeDevPhone(u.phone) !== phone) return false;
      if (name && normalizeDevName(u.name) && normalizeDevName(u.name) !== name) return false;
      return true;
    }) || null
  );
}
