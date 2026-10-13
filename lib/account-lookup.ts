import { getSqliteDb } from './sqlite';
import { findUserForLogin } from './accounts';

/**
 * "Do you already have an account?" — used before and during client sign-up.
 *
 * - Email: one account per email (hard rule, also enforced by registerSelfAccount).
 * - Phone: a family often shares one phone, so a match is a question for the user
 *   ("is it yours?"), never a block.
 * Phones are stored encrypted, so they are compared after decryption through a
 * small in-memory index (rebuilt at most once a minute).
 * Answers say only whether an account exists and how to sign in: never a name.
 */

/** Same rule as WhatsApp (lib/whatsapp/store.ts): Algerian 0XXXXXXXXX → 213XXXXXXXXX. */
export function phoneKey(raw?: string | null): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `213${d.slice(1)}`;
  return d.length >= 8 ? d : '';
}

let index: { at: number; byPhone: Map<string, string[]> } | null = null;

function phoneIndex(): Map<string, string[]> {
  if (index && Date.now() - index.at < 60_000) return index.byPhone;
  const byPhone = new Map<string, string[]>();
  const rows = getSqliteDb().prepare('SELECT id, phone FROM users').all() as { id: string; phone?: string }[];
  for (const r of rows) {
    const key = phoneKey(r.phone);
    if (key) byPhone.set(key, [...(byPhone.get(key) || []), r.id]);
  }
  index = { at: Date.now(), byPhone };
  return byPhone;
}

/** Call after creating or changing an account so the next check sees it. */
export function forgetPhoneIndex() {
  index = null;
}

export type ContactCheck = {
  email: { exists: boolean; google: boolean; password: boolean } | null;
  phone: { exists: boolean } | null;
};

export function checkContact(input: { email?: string; phone?: string }): ContactCheck {
  const email = String(input.email || '').trim().toLowerCase();
  const phone = phoneKey(input.phone);
  let emailResult: ContactCheck['email'] = null;
  if (email.includes('@')) {
    const user = findUserForLogin(email);
    emailResult = user
      ? { exists: true, google: Boolean(user.googleId || user.google_id), password: Boolean(user.passwordHash) }
      : { exists: false, google: false, password: false };
  }
  return {
    email: emailResult,
    phone: phone ? { exists: phoneIndex().has(phone) } : null,
  };
}
