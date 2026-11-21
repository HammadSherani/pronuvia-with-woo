// Payout lock: while the commission data is still being checked against the
// old site (a payout made there after our copy must not be paid twice), no
// payout can be approved and no "add your bank details" email can go out.
// Turned on with the env var PAYOUTS_LOCKED=1 (Vercel → Environment
// Variables, then redeploy); removing it unlocks.

export const PAYOUTS_LOCKED_MESSAGE =
  "Payouts are locked while the commission data is being checked. Approve and Notify are turned off until the lock is removed.";

export function payoutsLocked(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.PAYOUTS_LOCKED ?? "").trim());
}
