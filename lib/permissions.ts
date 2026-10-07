import { normalizeLoginRole, type LoginRole } from '@/lib/roles';

/**
 * Who may manage whom.
 *  - Super Admin (exactly one): manages Admins and every lower role.
 *    Created only by `npm run admin:setup`; nobody can create, promote to,
 *    demote, disable or delete it from the app.
 *  - Admin: manages Accountant, Guide, Staff and Pilgrim accounts.
 *  - Nobody changes their own role or access.
 */

const LOWER_ROLES: LoginRole[] = ['ACCOUNTANT', 'GUIDE_MURSHID', 'AGENCY_AGENT', 'PILGRIM_USER'];

export function assignableRoles(actorRole: LoginRole | string): LoginRole[] {
  const role = normalizeLoginRole(actorRole);
  if (role === 'SUPER_ADMIN') return ['AGENCY_MANAGER', ...LOWER_ROLES];
  if (role === 'AGENCY_MANAGER') return [...LOWER_ROLES];
  return [];
}

export type TargetAction = 'view' | 'profile' | 'access' | 'role' | 'password' | 'delete' | 'security';

export type ManageDecision = { ok: true; stepUp: boolean } | { ok: false; reason: string };

export function canManage(
  actor: { id: string; role: LoginRole | string },
  target: { id: string; role: LoginRole | string },
  action: TargetAction
): ManageDecision {
  const actorRole = normalizeLoginRole(actor.role);
  const targetRole = normalizeLoginRole(target.role);
  const self = actor.id === target.id;

  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'AGENCY_MANAGER') {
    return { ok: false, reason: 'صلاحية غير كافية' };
  }
  if (action === 'view') return { ok: true, stepUp: false };

  if (self) {
    if (action === 'profile') return { ok: true, stepUp: false };
    return { ok: false, reason: 'لا يمكنك تغيير صلاحيات حسابك أو حذفه' };
  }

  if (targetRole === 'SUPER_ADMIN') {
    return { ok: false, reason: 'حساب المشرف العام محمي ولا يُعدَّل من التطبيق' };
  }

  if (targetRole === 'AGENCY_MANAGER') {
    if (actorRole !== 'SUPER_ADMIN') return { ok: false, reason: 'إدارة حسابات المشرفين من صلاحية المشرف العام فقط' };
    if (action === 'password') {
      return { ok: false, reason: 'كلمة مرور المشرف تُعيَّن عبر رابط التفعيل فقط' };
    }
    return { ok: true, stepUp: true };
  }

  // Lower roles.
  return { ok: true, stepUp: action === 'delete' };
}
