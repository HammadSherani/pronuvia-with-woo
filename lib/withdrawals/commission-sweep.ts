import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentPeriod, type MonthlyPayoutPeriod } from "@/lib/withdrawals/monthly";
import { syncPendingPayoutRequest } from "@/lib/withdrawals/sync";

export type CommissionSweepResult = {
  periodKey:          string;
  ordersSwept:        number;
  salesRepsCredited:  number;
  physiciansCredited: number;
  totalCredited:      number;
};

/**
 * Credits every order placed within `period` to its owner's wallet, once —
 * this is what makes commission belong to the order's month rather than
 * whenever an admin happens to mark it COMPLETED. Runs from the auto-withdraw
 * cron on the 1st of the following month, right before payout requests are
 * built, so a just-swept balance is immediately eligible for withdrawal.
 *
 * Only orders still `commissionPaid: false` and not CANCELLED/REFUNDED are
 * included — an order refunded before its period closes never contributes
 * here at all. `commissionPaid` is the sweep's own idempotency guard: once
 * an order is swept it's excluded from every future run.
 */
export async function sweepCommissionPeriod(period: MonthlyPayoutPeriod): Promise<CommissionSweepResult> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt:      { gte: period.start, lt: period.end },
      commissionPaid: false,
      status:         { notIn: ["CANCELLED", "REFUNDED"] },
      OR: [
        { salesRepCommissionAmount:  { gt: 0 } },
        { physicianCommissionAmount: { gt: 0 } },
      ],
    },
    select: {
      id: true, orderNumber: true,
      salesRepId: true, salesRepCommissionAmount: true, salesRepClawback: true,
      physicianId: true, physicianCommissionAmount: true, physicianClawback: true,
    },
  });

  if (!orders.length) {
    return { periodKey: period.key, ordersSwept: 0, salesRepsCredited: 0, physiciansCredited: 0, totalCredited: 0 };
  }

  const netRep = (o: (typeof orders)[number]) => (o.salesRepCommissionAmount  ?? 0) - (o.salesRepClawback  ?? 0);
  const netDr  = (o: (typeof orders)[number]) => (o.physicianCommissionAmount ?? 0) - (o.physicianClawback ?? 0);

  const repCreditMap = new Map<string, number>();
  const drCreditMap  = new Map<string, number>();
  for (const o of orders) {
    if (o.salesRepId  && netRep(o) > 0) repCreditMap.set(o.salesRepId,  (repCreditMap.get(o.salesRepId)  ?? 0) + netRep(o));
    if (o.physicianId && netDr(o)  > 0) drCreditMap.set(o.physicianId, (drCreditMap.get(o.physicianId) ?? 0) + netDr(o));
  }

  const [reps, physicians] = await Promise.all([
    repCreditMap.size > 0
      ? prisma.salesRepresentative.findMany({ where: { id: { in: [...repCreditMap.keys()] } }, select: { id: true, walletBalance: true } })
      : [],
    drCreditMap.size > 0
      ? prisma.partneringPhysician.findMany({ where: { id: { in: [...drCreditMap.keys()] } }, select: { id: true, walletBalance: true } })
      : [],
  ]);
  const repBalances = new Map(reps.map((r) => [r.id, r.walletBalance]));
  const drBalances  = new Map(physicians.map((p) => [p.id, p.walletBalance]));

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { commissionPaid: true } }),
  ];

  for (const [repId, totalCredit] of repCreditMap) {
    const newBalance = parseFloat(((repBalances.get(repId) ?? 0) + totalCredit).toFixed(2));
    ops.push(prisma.salesRepresentative.update({ where: { id: repId }, data: { walletBalance: newBalance } }));

    let running = repBalances.get(repId) ?? 0;
    for (const o of orders.filter((o) => o.salesRepId === repId && netRep(o) > 0)) {
      running = parseFloat((running + netRep(o)).toFixed(2));
      ops.push(prisma.walletTransaction.create({
        data: {
          userId: repId, userRole: "SALES_REP",
          amount: netRep(o), type: "CREDIT",
          description: `Commission for order #${o.orderNumber} (${period.label})`,
          orderId: o.id, periodKey: period.key, balance: running,
        },
      }));
    }
  }

  for (const [drId, totalCredit] of drCreditMap) {
    const newBalance = parseFloat(((drBalances.get(drId) ?? 0) + totalCredit).toFixed(2));
    ops.push(prisma.partneringPhysician.update({ where: { id: drId }, data: { walletBalance: newBalance } }));

    let running = drBalances.get(drId) ?? 0;
    for (const o of orders.filter((o) => o.physicianId === drId && netDr(o) > 0)) {
      running = parseFloat((running + netDr(o)).toFixed(2));
      ops.push(prisma.walletTransaction.create({
        data: {
          userId: drId, userRole: "PHYSICIAN",
          amount: netDr(o), type: "CREDIT",
          description: `Commission for order #${o.orderNumber} (${period.label})`,
          orderId: o.id, periodKey: period.key, balance: running,
        },
      }));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(ops as any);

  const totalCredited = [...repCreditMap.values(), ...drCreditMap.values()].reduce((s, v) => s + v, 0);

  return {
    periodKey:          period.key,
    ordersSwept:        orders.length,
    salesRepsCredited:  repCreditMap.size,
    physiciansCredited: drCreditMap.size,
    totalCredited:      parseFloat(totalCredited.toFixed(2)),
  };
}

export type ReversibleOrder = {
  id: string;
  orderNumber: string;
  status: string;
  salesRepId: string | null;
  physicianId: string | null;
  salesRepCommissionAmount: number;
  physicianCommissionAmount: number;
  salesRepClawback: number | null;
  physicianClawback: number | null;
  commissionPaid: boolean;
};

export type ReversalResult = {
  reversed:              boolean;
  salesRepReversed:      number;
  physicianReversed:     number;
  newSalesRepClawback:   number | null;
  newPhysicianClawback:  number | null;
};

/**
 * Reverses whatever commission remains uncawed-back on `order` when it's
 * being cancelled or refunded — used both by the dedicated Refund flow and
 * by a direct status-dropdown cancellation of an already-swept order. A
 * no-op (idempotent) unless `order.commissionPaid` is true and there's
 * actually remaining commission to claw back, so calling this twice on the
 * same order never double-reverses. Dated to the CURRENT period, not the
 * order's original period, so it nets against new commission earned this
 * period per the refund/cancellation rule.
 */
export async function reverseOrderCommissionIfPaid(
  order: ReversibleOrder,
  targetStatus: "CANCELLED" | "REFUNDED",
  timeZone = process.env.PAYOUT_TIMEZONE ?? "UTC",
): Promise<ReversalResult> {
  const noop: ReversalResult = {
    reversed: false, salesRepReversed: 0, physicianReversed: 0,
    newSalesRepClawback: order.salesRepClawback, newPhysicianClawback: order.physicianClawback,
  };
  if (!order.commissionPaid || order.status === targetStatus) return noop;

  const remainingSalesRepCommission  = Math.max(0, order.salesRepCommissionAmount  - (order.salesRepClawback  ?? 0));
  const remainingPhysicianCommission = Math.max(0, order.physicianCommissionAmount - (order.physicianClawback ?? 0));
  if (remainingSalesRepCommission <= 0 && remainingPhysicianCommission <= 0) return noop;

  const currentPeriod = getCurrentPeriod(new Date(), timeZone);
  const verb = targetStatus === "CANCELLED" ? "cancelled" : "refunded";

  let newSalesRepClawback  = order.salesRepClawback;
  let newPhysicianClawback = order.physicianClawback;

  if (order.salesRepId && remainingSalesRepCommission > 0) {
    const rep = await prisma.salesRepresentative.findUnique({ where: { id: order.salesRepId }, select: { walletBalance: true } });
    const newBalance = parseFloat(((rep?.walletBalance ?? 0) - remainingSalesRepCommission).toFixed(2));
    await prisma.salesRepresentative.update({ where: { id: order.salesRepId }, data: { walletBalance: newBalance } });
    await prisma.walletTransaction.create({
      data: {
        userId:      order.salesRepId,
        userRole:    "SALES_REP",
        amount:      remainingSalesRepCommission,
        type:        "DEBIT",
        description: `Commission reversal — order #${order.orderNumber} ${verb}`,
        orderId:     order.id,
        periodKey:   currentPeriod.key,
        balance:     newBalance,
      },
    });
    await syncPendingPayoutRequest(order.salesRepId, "SALES_REP", newBalance);
    newSalesRepClawback = parseFloat(((order.salesRepClawback ?? 0) + remainingSalesRepCommission).toFixed(2));
  }

  if (order.physicianId && remainingPhysicianCommission > 0) {
    const physician = await prisma.partneringPhysician.findUnique({ where: { id: order.physicianId }, select: { walletBalance: true } });
    const newBalance = parseFloat(((physician?.walletBalance ?? 0) - remainingPhysicianCommission).toFixed(2));
    await prisma.partneringPhysician.update({ where: { id: order.physicianId }, data: { walletBalance: newBalance } });
    await prisma.walletTransaction.create({
      data: {
        userId:      order.physicianId,
        userRole:    "PHYSICIAN",
        amount:      remainingPhysicianCommission,
        type:        "DEBIT",
        description: `Commission reversal — order #${order.orderNumber} ${verb}`,
        orderId:     order.id,
        periodKey:   currentPeriod.key,
        balance:     newBalance,
      },
    });
    await syncPendingPayoutRequest(order.physicianId, "PHYSICIAN", newBalance);
    newPhysicianClawback = parseFloat(((order.physicianClawback ?? 0) + remainingPhysicianCommission).toFixed(2));
  }

  return {
    reversed: true,
    salesRepReversed:  remainingSalesRepCommission,
    physicianReversed: remainingPhysicianCommission,
    newSalesRepClawback,
    newPhysicianClawback,
  };
}
