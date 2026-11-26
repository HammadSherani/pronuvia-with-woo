// Payout lock: while the commission data is still being checked against the
// old site (a payout made there after our copy must not be paid twice), no
// payout can be approved and no "add your bank details" email can go out.
// Turned on with the env var PAYOUTS_LOCKED=1 (Vercel → Environment
// Variables, then redeploy); removing it unlocks.
//
// Test accounts: PAYOUTS_TEST_ACCOUNTS lists the email addresses of doctors /
// reps whose payouts stay open while the lock is on, so the whole payout flow
// can be tested without any real doctor being paid or emailed.

export const PAYOUTS_LOCKED_MESSAGE =
  "Payouts are locked while the commission data is being checked. Approve and Notify are turned off until the lock is removed.";

export function payoutsLocked(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.PAYOUTS_LOCKED ?? "").trim());
}

/** The test accounts (lower-case emails) whose payouts work while locked. */
export function payoutTestAccounts(): string[] {
  return (process.env.PAYOUTS_TEST_ACCOUNTS ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Locked for this user? (Not when the lock is off, or for a test account.) */
export function payoutsLockedFor(email: string | null | undefined): boolean {
  if (!payoutsLocked()) return false;
  return !(email && payoutTestAccounts().includes(email.trim().toLowerCase()));
}
