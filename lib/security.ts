import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { encryptValue, decryptValue, lookupHash } from './db-crypto';

const BCRYPT_ROUNDS = 12;
const LEGACY_SALT = 'SouthStreetSalt2026';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function hashPasswordLegacy(password: string, salt: string = LEGACY_SALT): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

export function verifyPassword(password: string, storedHash: string | undefined | null): boolean {
  if (!password || !storedHash) return false;
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compareSync(password, storedHash);
  }
  return storedHash === hashPasswordLegacy(password);
}

export function needsPasswordRehash(storedHash: string | undefined | null): boolean {
  if (!storedHash) return true;
  return !(storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$'));
}

export function encryptData(plainText: string): string {
  return encryptValue(plainText);
}

export function decryptData(encryptedText: string): string {
  return decryptValue(encryptedText);
}

export function generateDeviceFingerprint(
  ip: string,
  userAgent: string,
  acceptLang: string = ''
): { fingerprint: string; pcPrint: string } {
  const rawString = `${ip}-${userAgent}-${acceptLang}`;
  const hash = crypto.createHash('sha256').update(rawString).digest('hex').toUpperCase();
  const pcPrint = `FP-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  return { fingerprint: hash, pcPrint };
}

export function generateNewSecurityKey(): { keyString: string; fileContent: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex').toUpperCase();
  const keyId = `SOUTHSTREET-KEY-v1-${randomBytes.substring(0, 16)}`;
  const signature = crypto
    .createHmac('sha256', process.env.DB_ENCRYPTION_SECRET || 'SouthStreet-AES-256-SuperSecretKey-2026!')
    .update(keyId)
    .digest('hex')
    .toUpperCase();

  const fileContent = `-----BEGIN SOUTHSTREET SECURITY KEY BLOCK-----
Key-Id: ${keyId}
Algorithm: AES-256-GCM + HMAC-SHA256
Signature: ${signature}
Issued-To: admin@southstreet.dz
Security-Level: HIGH-SECURITY-ADMIN-2FA
Created-At: ${new Date().toISOString()}
-----END SOUTHSTREET SECURITY KEY BLOCK-----`;

  return { keyString: keyId, fileContent };
}

export { lookupHash };
