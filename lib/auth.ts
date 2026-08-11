import jwt from 'jsonwebtoken';
import { User, UserRole } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'south-street-secret-2026-key-prod';
const JWT_EXPIRES_IN = '24h';

export interface JwtPayload {
  sub: string;
  name: string;
  role: UserRole;
  roleName: string;
}

export function signToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      roleName: user.roleName,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: 'south-street' }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'south-street' }) as JwtPayload;
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
