import { prisma } from "@/lib/db/prisma";
import type { MonthlyPayoutPeriod, MonthlyPayoutUser } from "@/lib/withdrawals/monthly";
import { upsertRunningPayoutRequest } from "@/lib/withdrawals/running-request";
import { sweepCommissionPeriod } from "@/lib/withdrawals/commission-sweep";

/**
 * Credits every order in `period` to its owner's wallet, then (re)builds the
 * pending WithdrawRequest for every user left with a positive balance for
 * that period. Shared by the recurring monthly cron (previous-month close)
 * and any one-off manual sweep of a specific period.
 */
export async function runPayoutSweep(sweepPeriod: MonthlyPayoutPeriod) {
  const sweep = await sweepCommissionPeriod(sweepPeriod);
  console.log(`[payout-sweep] ${sweepPeriod.key} commission sweep`, sweep);

  // The requests' snapshot is taken after the sweep: a statement lists the
  // wallet credits up to its snapshot, so the commissions credited just now
  // must fall inside it.
  const period: MonthlyPayoutPeriod = { ...sweepPeriod, snapshotAt: new Date() };

  // Note: no bank-details filter here — an account without bank details on
  // file still needs a payout request created so it's visible to the admin
  // (with a "bank details missing" warning in the UI). Approval itself
  // still hard-blocks paying out without bank details (manage-withdrawals.ts).
  const [salesReps, physicians] = await Promise.all([
    prisma.salesRepresentative.findMany({
      where: { walletBalance: { gt: 0 } },
      select: { id: true, walletBalance: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
    }),
    prisma.partneringPhysician.findMany({
      where: {
        isApproved: "APPROVED",
        walletBalance: { gt: 0 },
      },
      select: { id: true, walletBalance: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
    }),
  ]);

  const users: MonthlyPayoutUser[] = [
    ...salesReps.map((user) => ({
      id: user.id,
      userRole: "SALES_REP" as const,
      walletBalance: user.walletBalance,
      hasBankAccount: Boolean(user.bankName && user.bankAccountNumber && user.bankAccountName),
    })),
    ...physicians.map((user) => ({
      id: user.id,
      userRole: "PHYSICIAN" as const,
      walletBalance: user.walletBalance,
      hasBankAccount: Boolean(user.bankName && user.bankAccountNumber && user.bankAccountName),
    })),
  ];

  // One running payout request per user for their whole balance: the same
  // request the commission approvals on the WP order page add to
  let touched = 0;
  for (const user of users) {
    await upsertRunningPayoutRequest(user.id, user.userRole);
    touched++;
  }

  const result = { success: true, period: period.label, sweep, requests: touched };
  console.log(`[payout-sweep] ${period.key} completed`, result);
  return result;
}
