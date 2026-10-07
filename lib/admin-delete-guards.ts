/**
 * Shared delete rules for the admin tables, used by /api/admin/db-tables and by
 * the dedicated /api/admin/morshids route so both enforce the same checks.
 * Columns and table names here are fixed strings, never taken from a request.
 */

export function countRows(db: any, sql: string, ...params: unknown[]): number {
  try {
    return Number((db.prepare(sql).get(...params) as any)?.c) || 0;
  } catch {
    return 0; // the linked table does not exist in this database
  }
}

/**
 * What still depends on a row. A blocker stops the delete; a note is shown in the
 * confirmation dialog. Columns are fixed here, never taken from the request.
 */
export function inspectDelete(db: any, table: string, row: any): { blocker: string | null; notes: string[] } {
  const notes: string[] = [];
  if (table === 'packages') {
    const id = row.package_id;
    const bookings = countRows(db, 'SELECT COUNT(*) c FROM reservations WHERE package_id = ?', id);
    if (bookings > 0) {
      return {
        blocker: `لا يمكن حذف الباقة: يوجد ${bookings} حجز مرتبط بها. غيّر حالتها إلى «ملغي» بدل الحذف.`,
        notes,
      };
    }
    notes.push('ستُحذف أسعار الغرف الخاصة بهذه الباقة أيضاً.');
  }
  if (table === 'hotels') {
    const id = row.hotel_id;
    const used = countRows(
      db,
      `SELECT COUNT(*) c FROM packages
       WHERE makkah_hotel_id = ? OR madinah_hotel_id = ? OR makkah_hotel_name = ? OR madinah_hotel_name = ?`,
      id, id, row.name, row.name
    );
    if (used > 0) {
      return { blocker: `لا يمكن حذف الفندق: ${used} باقة تستعمله. غيّر الفندق في تلك الباقات أولاً.`, notes };
    }
  }
  if (table === 'morshids') {
    const id = row.morshid_id;
    const pkgs = countRows(db, 'SELECT COUNT(*) c FROM packages WHERE morshid_id = ?', id);
    if (pkgs > 0) {
      return { blocker: `لا يمكن حذف العضو: هو مرشد في ${pkgs} باقة. غيّر المرشد في تلك الباقات أولاً.`, notes };
    }
    const salaries = countRows(db, 'SELECT COUNT(*) c FROM finance_staff_salaries WHERE morshid_id = ?', id);
    if (salaries > 0) {
      return {
        blocker: `لا يمكن حذف العضو: له ${salaries} سجل راتب في المحاسبة. أوقف حالته بدل الحذف للحفاظ على السجلات المالية.`,
        notes,
      };
    }
    notes.push('سيُوقَف حساب الدخول المرتبط بهذا العضو.');
  }
  if (table === 'seasons') {
    const id = row.season_id;
    const pkgs = countRows(db, 'SELECT COUNT(*) c FROM packages WHERE season_id = ?', id);
    if (pkgs > 0) {
      return { blocker: `لا يمكن حذف الموسم: ${pkgs} باقة مرتبطة به.`, notes };
    }
  }
  return { blocker: null, notes };
}


/** Staff logins must not outlive the staff profile; admin accounts are never touched. */
export function disableStaffLogin(db: any, morshidId: string) {
  try {
    db.prepare(
      `UPDATE users SET loginEnabled = 0, status = 'SUSPENDED'
        WHERE staffId = ? AND role NOT IN ('SUPER_ADMIN', 'AGENCY_MANAGER')`
    ).run(morshidId);
  } catch {
    // older databases without staffId: nothing to disable
  }
}
