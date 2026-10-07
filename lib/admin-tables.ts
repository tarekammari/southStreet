/**
 * Single source of truth for the "الجداول" (Tables) panel.
 *
 * The chat menu, the chat intents and the /api/admin/db-tables route all read
 * from here, so a table can no longer appear in the menu while the server
 * refuses it (that happened with users / messages / agency_settings).
 */

export interface AdminTableDef {
  label: string;
  icon: string;
  /** false → view and search only */
  write: boolean;
  /** only the Super Admin sees it */
  superOnly?: boolean;
}

/** Tables the editor can open. Order = order in the menu. */
export const ADMIN_TABLES: Record<string, AdminTableDef> = {
  packages: { label: 'باقات العمرة والحج', icon: '📦', write: true },
  hotels: { label: 'الفنادق المعتمدة', icon: '🏨', write: true },
  morshids: { label: 'المرشدين وطاقم العمل', icon: '👨‍💼', write: true },
  seasons: { label: 'المواسم والرحلات', icon: '🗓️', write: true },
  reviews: { label: 'تقييمات المعتمرين', icon: '⭐', write: true },
  ai_knowledge: { label: 'قواعد معرفة صخر AI', icon: '📖', write: true },
  page_content: { label: 'محتوى صفحات التطبيق', icon: '📄', write: true },
  receipts: { label: 'سندات القبض الرقمية', icon: '🧾', write: false, superOnly: true },
  audit_logs: { label: 'سجل تدقيق الأمان', icon: '🛡️', write: false, superOnly: true },
};

/**
 * Names people still say in chat ("أضف مستخدم") that must NOT be edited from
 * the generic editor. We answer with a short explanation instead of an error.
 */
export const REDIRECT_TABLES: Record<string, { label: string; href: string | null; message: string }> = {
  users: {
    label: 'المستخدمين والحسابات',
    href: '/admin',
    message:
      'الحسابات (كلمات المرور ومفاتيح الأمان والصلاحيات) تُدار من لوحة الإدارة المؤمَّنة، وليس من الجداول.',
  },
  messages: {
    label: 'رسائل الدردشة',
    href: null,
    message: 'رسائل الدردشة خاصة بأصحابها ولا تُعدَّل من الجداول.',
  },
  agency_settings: {
    label: 'إعدادات الوكالة',
    href: null,
    message: 'إعدادات الوكالة تحتوي مفاتيح أمان، لذلك لا تُعدَّل من الجداول.',
  },
};

export function isAdminTable(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADMIN_TABLES, name);
}

export function canReadTable(name: string, role: string): boolean {
  const t = ADMIN_TABLES[name];
  return Boolean(t && (!t.superOnly || role === 'SUPER_ADMIN'));
}

export function canWriteTable(name: string, role: string): boolean {
  return canReadTable(name, role) && ADMIN_TABLES[name].write;
}

/** Tables a given role sees in the menu, in menu order. */
export function tablesForRole(role: string): string[] {
  return Object.keys(ADMIN_TABLES).filter((name) => canReadTable(name, role));
}

/** Tables whose rows may only be deleted after a security-key tap. */
export const STEP_UP_DELETE_TABLES = new Set(['packages', 'morshids']);
