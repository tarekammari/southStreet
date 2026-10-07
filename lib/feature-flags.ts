/** Server-side feature flags from env (safe defaults). */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/** When true, new self-serve signups stay PENDING_APPROVAL until an admin approves. Default false = big-site self-serve. */
export function requireAdminApprovalForNewUsers(): boolean {
  return envFlag('REQUIRE_ADMIN_APPROVAL_FOR_NEW_USERS', false);
}

/** When true, show an enabled online card pay CTA (Stripe / CIB). Default false = coming soon. */
export function onlineCardPayEnabled(): boolean {
  return envFlag('ONLINE_CARD_PAY_ENABLED', false);
}

export function pilgrimSignupStatus(): 'APPROVED' | 'PENDING_APPROVAL' {
  return requireAdminApprovalForNewUsers() ? 'PENDING_APPROVAL' : 'APPROVED';
}
