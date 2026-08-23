import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { User, UserRole } from '@/types';
import { normalizePortalRole } from '@/lib/chat-utils';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  roleName: string;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies.get('south_street_token')?.value || null;
}

export function getAuthUser(req: NextRequest): AuthUser | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;
  return {
    id: payload.sub,
    name: payload.name,
    role: normalizePortalRole(payload.role, payload.email, payload.roleName),
    roleName: payload.roleName,
  };
}

export function authUserToUser(auth: AuthUser): User {
  return {
    id: auth.id,
    code: auth.id,
    name: auth.name,
    role: auth.role,
    roleName: auth.roleName,
    avatar: auth.name?.charAt(0) || 'م',
  };
}
