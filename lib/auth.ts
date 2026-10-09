import jwt from 'jsonwebtoken';
import { User, UserRole } from '@/types';

const DEFAULT_EXPIRES_IN = '24h';
/** Super Admin / Admin sessions are shorter-lived. */
export const PRIVILEGED_EXPIRES_IN = '8h';

/**
 * The signing secret must come from the environment. In production a missing
 * secret is a hard failure; a built-in fallback would let anyone mint tokens.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  }
  return secret || 'dev-only-insecure-jwt-secret-do-not-deploy';
}

export interface JwtPayload {
  sub: string;
  name: string;
  role: UserRole;
  roleName: string;
  username?: string;
  email?: string;
  /** True only when the session was opened with a hardware security key. */
  mfa?: boolean;
  /** Token generation; bumping users.tokenVersion revokes every older token. */
  tv?: number;
}

export function signToken(
  user: User,
  opts: { mfa?: boolean; tokenVersion?: number; expiresIn?: string } = {}
): string {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      roleName: user.roleName,
      username: user.username,
      email: user.email,
      mfa: opts.mfa === true ? true : undefined,
      tv: opts.tokenVersion ?? 0,
    },
    jwtSecret(),
    { expiresIn: (opts.expiresIn || DEFAULT_EXPIRES_IN) as jwt.SignOptions['expiresIn'], issuer: 'south-street' }
  );
}

/** Expired, tampered or foreign tokens are rejected — never accepted "leniently". */
export function verifyToken(token: string): JwtPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret(), { issuer: 'south-street' }) as JwtPayload;
  } catch {
    return null;
  }
}

/** Short-lived, single-purpose tokens (login second step, enrollment, step-up). */
export function signPurposeToken(payload: Record<string, unknown>, purpose: string, expiresIn: string): string {
  return jwt.sign({ ...payload, purpose }, jwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'south-street',
    audience: `ss:${purpose}`,
  });
}

export function verifyPurposeToken<T = Record<string, unknown>>(token: string, purpose: string): (T & { purpose: string }) | null {
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret(), { issuer: 'south-street', audience: `ss:${purpose}` }) as T & { purpose: string };
  } catch {
    return null;
  }
}

export function generateAccessCode(rolePrefix: string = 'VIP'): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${rolePrefix.toUpperCase()}-${randomDigits}`;
}

export function hasRolePermission(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === 'admin') return true;
  return allowedRoles.includes(userRole);
}
