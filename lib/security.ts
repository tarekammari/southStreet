import crypto from 'crypto';

const ENCRYPTION_SECRET = process.env.DB_ENCRYPTION_SECRET || 'SouthStreet-AES-256-SuperSecretKey-2026!';

// 1. Password Hashing (SHA-256 with Salt)
export function hashPassword(password: string, salt: string = 'SouthStreetSalt2026'): string {
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return hash;
}

// 2. AES-256 Data Encryption
export function encryptData(plainText: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    return plainText; // Fallback
  }
}

// 3. AES-256 Data Decryption
export function decryptData(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return encryptedText;
  }
}

// 4. Generate Device & PC Hardware Fingerprint (IP + Client Signatures)
export function generateDeviceFingerprint(ip: string, userAgent: string, acceptLang: string = ''): { fingerprint: string; pcPrint: string } {
  const rawString = `${ip}-${userAgent}-${acceptLang}`;
  const hash = crypto.createHash('sha256').update(rawString).digest('hex').toUpperCase();
  const pcPrint = `FP-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  return {
    fingerprint: hash,
    pcPrint
  };
}

// 5. Generate Admin Security Key (Strong Cryptographic Key Block)
export function generateNewSecurityKey(): { keyString: string; fileContent: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex').toUpperCase();
  const keyId = `SOUTHSTREET-KEY-v1-${randomBytes.substring(0, 16)}`;
  const signature = crypto.createHash('sha256').update(keyId + ENCRYPTION_SECRET).digest('hex').toUpperCase();

  const fileContent = `-----BEGIN SOUTHSTREET SECURITY KEY BLOCK-----
Key-Id: ${keyId}
Algorithm: AES-256-CBC + SHA256-HMAC
Signature: ${signature}
Issued-To: admin@southstreet.dz
Security-Level: HIGH-SECURITY-ADMIN-2FA
Created-At: ${new Date().toISOString()}
-----END SOUTHSTREET SECURITY KEY BLOCK-----`;

  return { keyString: keyId, fileContent };
}
