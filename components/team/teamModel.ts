import { LOGIN_ROLE_LABELS, type LoginRole } from '@/lib/roles';

/** One person as the Team workspace sees them: login account + optional staff profile. */
export type StaffProfile = {
  category: string;
  title: string;
  specialization: string;
  experience_years: number | null;
  languages: string[];
  rating: number | null;
  photo: string;
};

export type Member = {
  id: string;
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  photo?: string;
  role: LoginRole;
  roleName?: string;
  status: string;
  createdAt?: string;
  staffId?: string;
  loginEnabled?: boolean;
  googleLinked?: boolean;
  privileged?: boolean;
  securityKeys?: number;
  staff?: StaffProfile | null;
  isOnline?: boolean;
  lastLogin?: string | null;
  lastActive?: string | null;
  displayIp?: string;
  userAgent?: string | null;
};

export type Viewer = { id?: string; role: LoginRole; assignableRoles: LoginRole[] };

export type MemberState = 'active' | 'pending' | 'suspended' | 'invited';

export const STATE_LABEL: Record<MemberState, string> = {
  active: 'نشط',
  pending: 'بانتظار الموافقة',
  suspended: 'موقوف',
  invited: 'لم يُفعَّل بعد',
};

export function memberState(m: Member): MemberState {
  const s = String(m.status || '').toUpperCase();
  if (s === 'PENDING_APPROVAL' || s === 'PENDING') return 'pending';
  if (s === 'SUSPENDED' || s === 'REJECTED' || m.loginEnabled === false) return 'suspended';
  if (m.privileged && m.role !== 'SUPER_ADMIN' && !m.securityKeys) return 'invited';
  return 'active';
}

/** Member types offered when adding someone; each knows which API creates it. */
export type MemberType = {
  id: string;
  label: string;
  hint: string;
  role: LoginRole;
  /** staff category (creates a staff profile + login); absent = account only */
  category?: string;
  defaultTitle: string;
};

export const MEMBER_TYPES: MemberType[] = [
  { id: 'religious_guide', label: 'مرشد ديني', hint: 'يرافق المعتمرين ويؤطّر المناسك', role: 'GUIDE_MURSHID', category: 'religious_guide', defaultTitle: 'مرشد عمرة' },
  { id: 'women_guide', label: 'مرشدة نسائية', hint: 'ترافق الأخوات وتؤطّرهن', role: 'GUIDE_MURSHID', category: 'women_guide', defaultTitle: 'مرشدة نسائية' },
  { id: 'field_guide', label: 'مرشد ميداني', hint: 'التنقلات والفنادق في الميدان', role: 'GUIDE_MURSHID', category: 'field_guide', defaultTitle: 'مرشد ميداني' },
  { id: 'accountant', label: 'محاسب', hint: 'الخزينة والمدفوعات والتقارير', role: 'ACCOUNTANT', category: 'accountant', defaultTitle: 'محاسب الوكالة' },
  { id: 'staff', label: 'موظف الوكالة', hint: 'استقبال الطلبات ومتابعة العملاء', role: 'AGENCY_AGENT', category: 'staff', defaultTitle: 'موظف الوكالة' },
  { id: 'manager', label: 'مشرف (Admin)', hint: 'يدير الوكالة — دخوله بمفتاح أمان', role: 'AGENCY_MANAGER', defaultTitle: 'مشرف الوكالة' },
  { id: 'pilgrim', label: 'معتمر / حاج', hint: 'حساب عميل لمتابعة حجزه', role: 'PILGRIM_USER', defaultTitle: 'معتمر' },
];

export const CATEGORY_LABEL: Record<string, string> = {
  staff: 'موظف الوكالة',
  religious_guide: 'مرشد ديني',
  women_guide: 'مرشدة نسائية',
  field_guide: 'مرشد ميداني',
  accountant: 'محاسب',
};

export type TabId = 'team' | 'admins' | 'guides' | 'finance' | 'staff' | 'clients' | 'pending' | 'suspended' | 'online';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'team', label: 'الفريق' },
  { id: 'admins', label: 'الإدارة' },
  { id: 'guides', label: 'المرشدون' },
  { id: 'finance', label: 'المحاسبة' },
  { id: 'staff', label: 'الموظفون' },
  { id: 'clients', label: 'المعتمرون' },
  { id: 'pending', label: 'بانتظار الموافقة' },
  { id: 'suspended', label: 'موقوفون' },
  { id: 'online', label: 'متصل الآن' },
];

export function inTab(m: Member, tab: TabId): boolean {
  switch (tab) {
    case 'team':
      return m.role !== 'PILGRIM_USER';
    case 'admins':
      return m.role === 'SUPER_ADMIN' || m.role === 'AGENCY_MANAGER';
    case 'guides':
      return m.role === 'GUIDE_MURSHID';
    case 'finance':
      return m.role === 'ACCOUNTANT';
    case 'staff':
      return m.role === 'AGENCY_AGENT';
    case 'clients':
      return m.role === 'PILGRIM_USER';
    case 'pending':
      return memberState(m) === 'pending';
    case 'suspended':
      return memberState(m) === 'suspended';
    case 'online':
      return Boolean(m.isOnline);
  }
}

export function roleLabel(m: Member): string {
  if (m.staff?.category && CATEGORY_LABEL[m.staff.category]) return CATEGORY_LABEL[m.staff.category];
  return LOGIN_ROLE_LABELS[m.role] || m.roleName || '';
}

export function roleTone(role: LoginRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'gold';
    case 'AGENCY_MANAGER':
      return 'violet';
    case 'ACCOUNTANT':
      return 'blue';
    case 'GUIDE_MURSHID':
      return 'emerald';
    case 'AGENCY_AGENT':
      return 'slate';
    default:
      return 'sky';
  }
}

export function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '؟') + (parts[1]?.[0] || '');
}

export function relativeTime(value?: string | null): string {
  if (!value) return 'لم يدخل بعد';
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, Date.now() - t);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} د`;
  const h = Math.round(min / 60);
  if (h < 24) return `منذ ${h} سا`;
  const d = Math.round(h / 24);
  if (d < 30) return `منذ ${d} يوم`;
  return new Date(t).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fullDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function deviceLabel(ua?: string | null): string {
  const s = String(ua || '');
  if (!s) return '—';
  const os = /Windows/i.test(s) ? 'Windows' : /Android/i.test(s) ? 'Android' : /iPhone|iPad|iOS/i.test(s) ? 'iOS' : /Mac OS/i.test(s) ? 'macOS' : /Linux/i.test(s) ? 'Linux' : 'جهاز';
  const browser = /Edg\//i.test(s) ? 'Edge' : /Chrome\//i.test(s) ? 'Chrome' : /Firefox\//i.test(s) ? 'Firefox' : /Safari\//i.test(s) ? 'Safari' : '';
  return browser ? `${browser} · ${os}` : os;
}
