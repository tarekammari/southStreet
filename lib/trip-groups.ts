/**
 * Every programme (Umrah, Hajj, tourist trip) has one SS Connect group. A
 * client joins it automatically once the agency's confirmation is final
 * (deposit recorded); the programme's guide and the agency desk are its admins.
 * Hotel-only stays have no group.
 */
import { getSqliteDb } from '@/lib/sqlite';
import { isAgencyConfirmed, isAwaitingDepositConfirmation, isTripOver } from '@/lib/booking-catalog';
import { addMembers, allGroups, createGroup, postToGroup, syncProgram, type ConnectGroup } from '@/lib/connect/groups';
import { activeUsers, type ConnectUser } from '@/lib/connect/store';

/** Who speaks for the agency in trip groups: the desk account and the managers, else the Super Admin. */
function agencyTeam(): ConnectUser[] {
  const users = activeUsers();
  const desk = users.filter((u) => u.id === 'usr_agent');
  const managers = users.filter((u) => u.role === 'AGENCY_MANAGER');
  const team = [...desk, ...managers];
  return team.length ? team : users.filter((u) => u.role === 'SUPER_ADMIN').slice(0, 1);
}

function programGroup(packageId: string, team: ConnectUser[]): ConnectGroup | null {
  const existing = allGroups().filter((g) => g.packageId === packageId);
  const open = existing.find((g) => !g.closed);
  if (open || existing.length) return open || null;

  const pkg = getSqliteDb().prepare('SELECT name, morshid_name FROM packages WHERE package_id = ?').get(packageId) as
    | { name?: string; morshid_name?: string }
    | undefined;
  if (!pkg || !team.length) return null;
  const name = String(pkg.name || 'الرحلة');
  const guide = pkg.morshid_name ? `المرشد ${pkg.morshid_name}` : 'المرشد';
  const group = createGroup(
    {
      name: `مجموعة ${name}`,
      description: `${guide} وفريق الوكالة مع المسافرين المؤكَّدين — المواعيد والتعليمات طوال الرحلة.`,
      packageId,
      mode: 'all',
    },
    team[0]
  );
  addMembers(group.id, team.map((u) => u.id), 'admin');
  postToGroup(group, team[0], {
    kind: 'text',
    text: `أهلاً بكم في مجموعة «${name}». هنا تجدون ${guide} وفريق الوكالة: المواعيد، نقاط التجمع، والتعليمات قبل السفر وأثناءه. يُضاف كل مسافر تلقائياً عند تأكيد حجزه.`,
  });
  return group;
}

/**
 * Puts the client of a finally-confirmed trip booking in their programme's group
 * (with the guide and the agency). Returns the group when the client is in it.
 */
export function joinTripGroup(reservationId: string): { group: ConnectGroup; added: boolean } | null {
  const row = getSqliteDb().prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId) as any;
  if (!row?.customer_id || !row.package_id) return null;
  if (row.booking_type === 'HOTEL' || String(row.package_id).startsWith('hotel:')) return null;
  const status = String(row.reservation_status || '');
  if (!isAgencyConfirmed(status) || isAwaitingDepositConfirmation(status, row.payment_status, Number(row.paid_amount) || 0)) return null;
  let program: any = null;
  try {
    program = row.program ? JSON.parse(row.program) : null;
  } catch {
    program = null;
  }
  if (isTripOver({ status, program })) return null;

  const team = agencyTeam();
  const group = programGroup(String(row.package_id), team);
  if (!group) return null;
  const added = addMembers(group.id, [String(row.customer_id)], 'member') > 0;
  syncProgram(group.id);
  addMembers(group.id, team.map((u) => u.id), 'admin');
  return { group, added };
}
