import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { getSqliteDb } from '@/lib/sqlite';
import { lookupHash } from '@/lib/db-crypto';
import { signPurposeToken, verifyPurposeToken } from '@/lib/auth';

/**
 * Hardware security keys (FIDO2 / WebAuthn: YubiKey, Windows Hello, phone
 * passkeys) for the Super Admin and Admins, plus one-time recovery codes and
 * one-time enrollment links.
 */

const RP_NAME = 'South Street';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const RECOVERY_CODE_COUNT = 10;
export const MAX_KEYS_PER_USER = 10;

export type ChallengePurpose = 'login' | 'register' | 'step-up';

/**
 * 'platform' = this device's built-in authenticator (Windows Hello, Touch ID,
 * Android fingerprint); 'cross-platform' = USB/NFC key or a phone.
 * Undefined lets the browser offer every option.
 */
export type KeyKind = 'platform' | 'cross-platform';

export function parseKeyKind(value: unknown): KeyKind | undefined {
  return value === 'platform' || value === 'cross-platform' ? value : undefined;
}

type RpConfig = { rpID: string; origins: string[] };

/**
 * Keys are bound to the domain. Production must pin it in .env
 * (WEBAUTHN_RP_ID, WEBAUTHN_ORIGINS); development follows the request host.
 */
export function rpConfig(req: Request): RpConfig {
  const rpID = process.env.WEBAUTHN_RP_ID?.trim();
  const origins = (process.env.WEBAUTHN_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (rpID && origins.length) return { rpID, origins };
  const url = new URL(req.url);
  const host = req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const hostname = host.split(':')[0];
  // Browsers only allow security keys on HTTPS or localhost, so a local
  // production run may follow the request; real domains must be pinned.
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (process.env.NODE_ENV === 'production' && !local) {
    throw new Error('WEBAUTHN_NOT_CONFIGURED');
  }
  return { rpID: rpID || hostname, origins: origins.length ? origins : [`${proto}://${host}`] };
}

/* ------------------------------------------------------------------ *
 * Single-use challenges
 * ------------------------------------------------------------------ */

function saveChallenge(userId: string, purpose: ChallengePurpose, challenge: string): string {
  const db = getSqliteDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  db.prepare('DELETE FROM auth_challenges WHERE expires_at < ?').run(now);
  db.prepare('INSERT INTO auth_challenges (id, user_id, challenge, purpose, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, challenge, purpose, now + CHALLENGE_TTL_MS);
  return id;
}

function takeChallenge(id: string, userId: string, purpose: ChallengePurpose): string | null {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(id) as any;
  if (!row) return null;
  db.prepare('DELETE FROM auth_challenges WHERE id = ?').run(id);
  if (row.user_id !== userId || row.purpose !== purpose || Number(row.expires_at) < Date.now()) return null;
  return String(row.challenge);
}

function flowToken(userId: string, challengeId: string, purpose: ChallengePurpose, extra: Record<string, unknown> = {}) {
  return signPurposeToken({ sub: userId, cid: challengeId, ...extra }, `webauthn-${purpose}`, '5m');
}

export function readFlowToken(token: string, purpose: ChallengePurpose) {
  return verifyPurposeToken<{ sub: string; cid: string; [k: string]: unknown }>(token, `webauthn-${purpose}`);
}

/* ------------------------------------------------------------------ *
 * Credentials
 * ------------------------------------------------------------------ */

export type StoredCredential = {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports?: string;
  label?: string;
  created_at?: string;
  last_used_at?: string;
};

export function listCredentials(userId: string): StoredCredential[] {
  return getSqliteDb()
    .prepare('SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId) as StoredCredential[];
}

export function countCredentials(userId: string): number {
  const row = getSqliteDb().prepare('SELECT count(*) AS n FROM webauthn_credentials WHERE user_id = ?').get(userId) as { n: number };
  return Number(row?.n) || 0;
}

export function deleteCredential(userId: string, credentialId: string): boolean {
  const res = getSqliteDb()
    .prepare('DELETE FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?')
    .run(userId, credentialId);
  return res.changes > 0;
}

function parseTransports(raw?: string): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : undefined;
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ *
 * Registration (adding a key)
 * ------------------------------------------------------------------ */

export async function beginRegistration(
  req: Request,
  user: { id: string; username?: string; name?: string },
  extra: Record<string, unknown> = {},
  kind?: KeyKind
) {
  const { rpID } = rpConfig(req);
  const existing = listCredentials(user.id);
  if (existing.length >= MAX_KEYS_PER_USER) throw new Error('MAX_KEYS');
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.username || user.id,
    userDisplayName: user.name || user.username || user.id,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) })),
    authenticatorSelection: {
      residentKey: 'preferred',
      // Windows Hello always asks for the PIN / fingerprint, so require it there.
      userVerification: kind === 'platform' ? 'required' : 'preferred',
      ...(kind ? { authenticatorAttachment: kind } : {}),
    },
  });
  const cid = saveChallenge(user.id, 'register', options.challenge);
  return { options, flowToken: flowToken(user.id, cid, 'register', extra) };
}

export async function finishRegistration(
  req: Request,
  token: string,
  response: RegistrationResponseJSON,
  label: string
): Promise<{ userId: string; credentialId: string; flow: Record<string, unknown> }> {
  const flow = readFlowToken(token, 'register');
  if (!flow) throw new Error('FLOW_EXPIRED');
  const challenge = takeChallenge(String(flow.cid), flow.sub, 'register');
  if (!challenge) throw new Error('FLOW_EXPIRED');
  const { rpID, origins } = rpConfig(req);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('KEY_NOT_VERIFIED');

  const { credential } = verification.registrationInfo;
  const db = getSqliteDb();
  const taken = db.prepare('SELECT user_id FROM webauthn_credentials WHERE credential_id = ?').get(credential.id);
  if (taken) throw new Error('KEY_ALREADY_REGISTERED');
  db.prepare(`
    INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports, label, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    credential.id,
    flow.sub,
    Buffer.from(credential.publicKey).toString('base64url'),
    credential.counter || 0,
    JSON.stringify(credential.transports || response.response.transports || []),
    (label || 'مفتاح أمان').slice(0, 60),
    new Date().toISOString()
  );
  return { userId: flow.sub, credentialId: credential.id, flow };
}

/* ------------------------------------------------------------------ *
 * Authentication (sign-in second step and step-up)
 * ------------------------------------------------------------------ */

export async function beginAuthentication(
  req: Request,
  userId: string,
  purpose: 'login' | 'step-up',
  extra: Record<string, unknown> = {}
) {
  const creds = listCredentials(userId);
  if (!creds.length) return null;
  const { rpID } = rpConfig(req);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) })),
    userVerification: 'preferred',
  });
  const cid = saveChallenge(userId, purpose, options.challenge);
  return { options, flowToken: flowToken(userId, cid, purpose, extra) };
}

export async function finishAuthentication(
  req: Request,
  token: string,
  response: AuthenticationResponseJSON,
  purpose: 'login' | 'step-up'
): Promise<{ userId: string; flow: Record<string, unknown> }> {
  const flow = readFlowToken(token, purpose);
  if (!flow) throw new Error('FLOW_EXPIRED');
  const challenge = takeChallenge(String(flow.cid), flow.sub, purpose);
  if (!challenge) throw new Error('FLOW_EXPIRED');

  const db = getSqliteDb();
  const stored = db
    .prepare('SELECT * FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?')
    .get(response.id, flow.sub) as StoredCredential | undefined;
  if (!stored) throw new Error('KEY_UNKNOWN');

  const { rpID, origins } = rpConfig(req);
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: stored.credential_id,
      publicKey: new Uint8Array(Buffer.from(stored.public_key, 'base64url')),
      counter: Number(stored.counter) || 0,
      transports: parseTransports(stored.transports),
    },
  });
  if (!verification.verified) throw new Error('KEY_NOT_VERIFIED');

  db.prepare('UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?')
    .run(verification.authenticationInfo.newCounter, new Date().toISOString(), stored.credential_id);
  return { userId: flow.sub, flow };
}

/* ------------------------------------------------------------------ *
 * Recovery codes (shown once, stored as keyed hashes)
 * ------------------------------------------------------------------ */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomRecoveryCode(): string {
  const bytes = crypto.randomBytes(10);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

function normalizeRecoveryCode(code: string): string {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function issueRecoveryCodes(userId: string): string[] {
  const db = getSqliteDb();
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  const insert = db.prepare('INSERT INTO recovery_codes (id, user_id, codeHash, used_at) VALUES (?, ?, ?, NULL)');
  db.transaction(() => {
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(userId);
    for (const code of codes) {
      insert.run(crypto.randomBytes(8).toString('hex'), userId, lookupHash(`recovery:${normalizeRecoveryCode(code)}`));
    }
  })();
  return codes;
}

export function remainingRecoveryCodes(userId: string): number {
  const rows = getSqliteDb().prepare('SELECT used_at FROM recovery_codes WHERE user_id = ?').all(userId) as { used_at?: string }[];
  return rows.filter((r) => !r.used_at).length;
}

export function consumeRecoveryCode(userId: string, code: string): boolean {
  const clean = normalizeRecoveryCode(code);
  if (clean.length !== 10) return false;
  const db = getSqliteDb();
  const row = db
    .prepare('SELECT id, used_at FROM recovery_codes WHERE user_id = ? AND codeHash = ?')
    .get(userId, lookupHash(`recovery:${clean}`)) as { id: string; used_at?: string } | undefined;
  if (!row || row.used_at) return false;
  db.prepare('UPDATE recovery_codes SET used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  return true;
}

/* ------------------------------------------------------------------ *
 * One-time enrollment links
 * ------------------------------------------------------------------ */

export const ENROLLMENT_TTL_MINUTES = 60;

export function createEnrollmentToken(userId: string, reason: string, createdBy: string, ttlMinutes = ENROLLMENT_TTL_MINUTES): string {
  const db = getSqliteDb();
  const token = crypto.randomBytes(32).toString('base64url');
  db.transaction(() => {
    // A fresh link replaces any earlier unused one.
    db.prepare('DELETE FROM enrollment_tokens WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO enrollment_tokens (tokenHash, user_id, reason, created_by, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)')
      .run(lookupHash(`enroll:${token}`), userId, reason, createdBy, Date.now() + ttlMinutes * 60 * 1000);
  })();
  return token;
}

export function readEnrollmentToken(token: string): { userId: string; reason: string } | null {
  if (!token || token.length < 32) return null;
  const row = getSqliteDb()
    .prepare('SELECT * FROM enrollment_tokens WHERE tokenHash = ?')
    .get(lookupHash(`enroll:${token}`)) as any;
  if (!row || row.used_at || Number(row.expires_at) < Date.now()) return null;
  return { userId: String(row.user_id), reason: String(row.reason || '') };
}

export function consumeEnrollmentToken(token: string): boolean {
  const res = getSqliteDb()
    .prepare('UPDATE enrollment_tokens SET used_at = ? WHERE tokenHash = ? AND used_at IS NULL')
    .run(new Date().toISOString(), lookupHash(`enroll:${token}`));
  return res.changes > 0;
}

/* ------------------------------------------------------------------ *
 * Session revocation
 * ------------------------------------------------------------------ */

/** Invalidates every token issued to this user so far. */
export function bumpTokenVersion(userId: string) {
  getSqliteDb().prepare('UPDATE users SET tokenVersion = IFNULL(tokenVersion, 0) + 1 WHERE id = ?').run(userId);
}

export function tokenVersionOf(userId: string): number {
  const row = getSqliteDb().prepare('SELECT tokenVersion FROM users WHERE id = ?').get(userId) as { tokenVersion?: number } | undefined;
  return Number(row?.tokenVersion) || 0;
}

/** Lost-everything reset: removes keys, recovery codes and links; signs the user out everywhere. */
export function resetSecurityFactors(userId: string) {
  const db = getSqliteDb();
  db.transaction(() => {
    db.prepare('DELETE FROM webauthn_credentials WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM enrollment_tokens WHERE user_id = ?').run(userId);
  })();
  bumpTokenVersion(userId);
}

/** Base URL used in enrollment links (setup command and invites). */
export function appOrigin(req?: Request): string {
  const configured = (process.env.APP_ORIGIN || process.env.WEBAUTHN_ORIGINS || '').split(',')[0]?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (req) {
    const url = new URL(req.url);
    return `${req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')}://${req.headers.get('host') || url.host}`;
  }
  return 'http://localhost:3000';
}
