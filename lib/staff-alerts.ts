import { getSqliteDb } from './sqlite';
import { normalizeLoginRole } from './roles';
import { pushTo } from './connect/push';

/**
 * Phone notifications (Connect app push) for agency events, so nobody has to
 * remember to look: e.g. a new testimonial waiting for approval. Only people who
 * enabled notifications in Connect receive them; failures are ignored.
 */
export async function alertManagers(input: { title: string; body: string; url: string; tag: string }): Promise<void> {
  try {
    const rows = getSqliteDb().prepare('SELECT id, role, email, roleName FROM users').all() as any[];
    const managers = rows.filter((u) => {
      const role = normalizeLoginRole(u.role, { email: u.email, roleName: u.roleName });
      return role === 'SUPER_ADMIN' || role === 'AGENCY_MANAGER';
    });
    await Promise.all(managers.map((m) => pushTo(m.id, { kind: 'message', ...input }).catch(() => undefined)));
  } catch {
    /* alerts are best effort */
  }
}

export async function alertUser(userId: string, input: { title: string; body: string; url: string; tag: string }): Promise<void> {
  if (!userId) return;
  await pushTo(userId, { kind: 'message', ...input }).catch(() => undefined);
}
