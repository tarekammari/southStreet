/**
 * Server secrets in one place. In production every secret must come from the
 * environment and be long enough; there is no built-in fallback, because a
 * fallback written in the source code is public and protects nothing.
 *
 *   DB_ENCRYPTION_SECRET — AES-256-GCM key material for encrypted columns
 *   DB_LOOKUP_SECRET     — HMAC key for searchable hashes (email, username, codes)
 *
 * Changing either one needs `npm run db:rekey` (re-encrypts / re-hashes the data).
 */

/** The key the app used before secrets were required. Only for dev and the re-key script. */
export const LEGACY_DB_SECRET = 'SouthStreet-AES-256-SuperSecretKey-2026!';

const MIN_LENGTH = 32;

function required(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (v && v.length >= MIN_LENGTH) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is missing or shorter than ${MIN_LENGTH} characters — set it in the server environment (.env).`);
  }
  return v || LEGACY_DB_SECRET;
}

export function dbEncryptionSecret(): string {
  return required('DB_ENCRYPTION_SECRET', process.env.DB_ENCRYPTION_SECRET || process.env.SERVER_ENCRYPTION_KEY);
}

export function dbLookupSecret(): string {
  return process.env.DB_LOOKUP_SECRET?.trim() ? required('DB_LOOKUP_SECRET', process.env.DB_LOOKUP_SECRET) : dbEncryptionSecret();
}
