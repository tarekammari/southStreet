import { normalizeLoginRole } from '@/lib/roles';
import { countCredentials } from '@/lib/webauthn';

/**
 * Per installation, the agency owner may open the Super Admin with Google
 * instead of password + security key: set SUPER_ADMIN_GOOGLE_EMAIL in .env to
 * the Super Admin's email. Off when unset (South Street keeps security keys).
 *
 * Only a Google sign-in whose verified email is that address, on the Super
 * Admin account carrying the same email, qualifies. Until the owner registers
 * a key, Google alone opens the account; after that Google is the first step
 * and the key (the phone's fingerprint) the second, and key step-ups return.
 */
export function ownerGoogleEmail(): string {
  return String(process.env.SUPER_ADMIN_GOOGLE_EMAIL || '').trim().toLowerCase();
}

export function isOwnerGoogleSuperAdmin(user: any, googleEmail?: string): boolean {
  const owner = ownerGoogleEmail();
  if (!owner || !user) return false;
  if (normalizeLoginRole(user.role) !== 'SUPER_ADMIN') return false;
  if (String(user.email || '').trim().toLowerCase() !== owner) return false;
  return googleEmail === undefined || googleEmail.trim().toLowerCase() === owner;
}

/** Without a registered key there is nothing to tap: such an owner skips key step-ups. */
export function ownerSkipsStepUp(user: any): boolean {
  return isOwnerGoogleSuperAdmin(user) && countCredentials(String(user.id)) === 0;
}
