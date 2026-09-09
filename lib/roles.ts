/**
 * Canonical login roles and the portal options each role is allowed to use.
 */

export const LOGIN_ROLES = [
  'SUPER_ADMIN',
  'AGENCY_MANAGER',
  'ACCOUNTANT',
  'GUIDE_MURSHID',
  'AGENCY_AGENT',
  'PILGRIM_USER',
] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

export type PortalRole = 'admin' | 'manager' | 'murshid' | 'accountant' | 'agent' | 'pilgrim';

export const LOGIN_ROLE_LABELS: Record<LoginRole, string> = {
  SUPER_ADMIN: 'مدير النظام العام',
  AGENCY_MANAGER: 'مدير الوكالة',
  ACCOUNTANT: 'محاسب الوكالة',
  GUIDE_MURSHID: 'مرشد ديني',
  AGENCY_AGENT: 'موظف الوكالة',
  PILGRIM_USER: 'معتمر / حاج',
};

export const LOGIN_ROLE_OPTIONS = LOGIN_ROLES.map((value) => ({
  value,
  label: LOGIN_ROLE_LABELS[value],
}));

export function isLoginRole(value: string | undefined | null): value is LoginRole {
  return Boolean(value && (LOGIN_ROLES as readonly string[]).includes(value));
}

export function normalizeLoginRole(
  role?: string,
  extra?: { email?: string; roleName?: string; category?: string; status?: string }
): LoginRole {
  const r = (role || '').toUpperCase();
  if (isLoginRole(r)) return r;
  if (r === 'ADMIN' || r === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (r === 'MANAGER') return 'AGENCY_MANAGER';
  if (r === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (r === 'MURSHID' || r === 'GUIDE' || r === 'GUIDE_MURSHID') return 'GUIDE_MURSHID';
  if (r === 'AGENT' || r === 'STAFF') return 'AGENCY_AGENT';
  if (r === 'PILGRIM' || r === 'USER') return 'PILGRIM_USER';

  const name = extra?.roleName || '';
  const email = (extra?.email || '').toLowerCase();
  const category = extra?.category || '';
  const status = extra?.status || '';

  if (name.includes('المدير العام') || status === 'إدارة الوكالة') return 'AGENCY_MANAGER';
  if (name.includes('محاسب') || category === 'accountant' || email.includes('accountant')) return 'ACCOUNTANT';
  if (
    name.includes('مرشد') ||
    category === 'religious_guide' ||
    category === 'women_guide' ||
    category === 'field_guide' ||
    email.includes('guide')
  ) {
    return 'GUIDE_MURSHID';
  }
  if (email.includes('admin')) return 'SUPER_ADMIN';
  if (email.includes('manager')) return 'AGENCY_MANAGER';
  if (category === 'staff') return 'AGENCY_AGENT';
  if (r === 'AGENCY_AGENT') return 'AGENCY_AGENT';
  return 'PILGRIM_USER';
}

export function loginRoleFromStaff(category?: string, roleName?: string, status?: string): LoginRole {
  return normalizeLoginRole('', { category, roleName, status });
}

export function toPortalRole(role?: string, extra?: { email?: string; roleName?: string }): PortalRole {
  const login = normalizeLoginRole(role, extra);
  switch (login) {
    case 'SUPER_ADMIN':
      return 'admin';
    case 'AGENCY_MANAGER':
      return 'manager';
    case 'ACCOUNTANT':
      return 'accountant';
    case 'GUIDE_MURSHID':
      return 'murshid';
    case 'AGENCY_AGENT':
      return 'agent';
    default:
      return 'pilgrim';
  }
}

export type AppRedirectPath = '/admin' | '/portal' | '/book';

export function postLoginPath(role: LoginRole | string): '/admin' | '/portal' {
  const login = normalizeLoginRole(role);
  return login === 'SUPER_ADMIN' || login === 'AGENCY_MANAGER' ? '/admin' : '/portal';
}

export function requiresSecurityKey(role: LoginRole | string): boolean {
  const login = normalizeLoginRole(role);
  return login === 'SUPER_ADMIN' || login === 'AGENCY_MANAGER';
}

export const PORTAL_TABS: Record<PortalRole, { tab: string; label: string }[]> = {
  admin: [
    { tab: 'admin', label: 'لوحة الإدارة' },
    { tab: 'admin_ai', label: 'تدريب صخر' },
    { tab: 'security', label: 'أمان الحساب' },
    { tab: 'chat', label: 'المحادثة' },
  ],
  manager: [
    { tab: 'manager', label: 'إدارة الأفواج' },
    { tab: 'admin', label: 'لوحة الإدارة' },
    { tab: 'security', label: 'أمان الحساب' },
    { tab: 'chat', label: 'المحادثة' },
  ],
  murshid: [
    { tab: 'murshid', label: 'لوحة المرشد' },
    { tab: 'rituals', label: 'المناسك' },
    { tab: 'security', label: 'أمان الحساب' },
    { tab: 'chat', label: 'المحادثة' },
  ],
  accountant: [
    { tab: 'accountant', label: 'لوحة المحاسب' },
    { tab: 'security', label: 'أمان الحساب' },
    { tab: 'chat', label: 'المراسلة' },
  ],
  agent: [
    { tab: 'agent', label: 'لوحة الموظف' },
    { tab: 'security', label: 'أمان الحساب' },
    { tab: 'chat', label: 'المحادثة' },
  ],
  pilgrim: [
    { tab: 'program', label: 'رحلتي' },
    { tab: 'chat', label: 'رسائل' },
    { tab: 'account', label: 'حسابي' },
  ],
};

/** Old pilgrim URLs still work; they land on the simplified 3-step portal. */
const PILGRIM_TAB_ALIASES: Record<string, string> = {
  reservations: 'program',
  documents: 'program',
  payments: 'program',
  rituals: 'program',
  reviews: 'account',
  security: 'account',
};

export type PilgrimHomeSection = 'trip' | 'docs' | 'pay' | 'rites';

export function pilgrimHomeSection(tab?: string | null): PilgrimHomeSection {
  if (tab === 'documents') return 'docs';
  if (tab === 'payments') return 'pay';
  if (tab === 'rituals') return 'rites';
  return 'trip';
}

export function resolvePortalTab(role: PortalRole, tab?: string | null): string {
  const raw = String(tab || '').trim();
  const mapped = role === 'pilgrim' && PILGRIM_TAB_ALIASES[raw] ? PILGRIM_TAB_ALIASES[raw] : raw;
  const allowed = PORTAL_TABS[role].map((t) => t.tab);
  if (mapped && allowed.includes(mapped)) return mapped;
  return defaultPortalTab(role);
}

export function defaultPortalTab(role: PortalRole): string {
  return PORTAL_TABS[role][0]?.tab || 'program';
}

export function roleNameForLoginRole(role: LoginRole, fallback?: string): string {
  return fallback || LOGIN_ROLE_LABELS[role];
}
