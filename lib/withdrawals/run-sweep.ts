import { prisma } from "@/lib/db/prisma";
import {
  buildMonthlyPayoutPlan,
  monthlyPayoutRequestId,
  type MonthlyPayoutPeriod,
  type MonthlyPayoutRequest,
  type MonthlyPayoutUser,
} from "@/lib/withdrawals/monthly";
import { sweepCommissionPeriod } from "@/lib/withdrawals/commission-sweep";

/**
 * Credits every order in `period` to its owner's wallet, then (re)builds the
 * pending WithdrawRequest for every user left with a positive balance for
 * that period. Shared by the recurring monthly cron (previous-month close)
 * and any one-off manual sweep of a specific period.
 */
export async function runPayoutSweep(period: MonthlyPayoutPeriod) {
  const sweep = await sweepCommissionPeriod(period);
  console.log(`[payout-sweep] ${period.key} commission sweep`, sweep);

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

  if (!users.length) {
    return { success: true, period: period.label, sweep, created: 0, updated: 0, removed: 0, alreadyApproved: 0 };
  }

  const requests = await prisma.withdrawRequest.findMany({
    where: { OR: users.map((user) => ({ userId: user.id, userRole: user.userRole })) },
    select: {
      id: true, userId: true, userRole: true, amount: true, status: true, note: true,
      periodKey: true, snapshotAt: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const plan = buildMonthlyPayoutPlan({ users, requests: requests as MonthlyPayoutRequest[], period });

  if (plan.remove.length) {
    await prisma.withdrawRequest.deleteMany({ where: { id: { in: plan.remove } } });
  }
  if (plan.update.length) {
    await Promise.all(plan.update.map((item) => prisma.withdrawRequest.update({
      where: { id: item.id },
      data: { amount: item.amount, note: item.note },
    })));
  }
  let created = 0;
  for (const item of plan.create) {
    try {
      await prisma.withdrawRequest.create({
        data: {
          id: monthlyPayoutRequestId(item.userId, item.userRole, item.periodKey),
          ...item,
        },
      });
      created++;
    } catch (error) {
      // A concurrent invocation may have created the same deterministic
      // request. Treat that one race as success; surface all other failures.
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }

  const result = {
    success: true,
    period: period.label,
    sweep,
    created,
    updated: plan.update.length,
    removed: plan.remove.length,
    alreadyApproved: plan.skipApproved.length,
  };
  console.log(`[payout-sweep] ${period.key} completed`, result);
  return result;
}
