import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/generated/prisma/enums";
import { periodFromKey } from "@/lib/withdrawals/monthly";

export type PayoutStatementOrder = {
  orderNumber: string;
  createdAt: Date;
  amount: number;
  rate: number;
  description?: string | null;
  // Fully refunded / cancelled in the payout's month: listed at $0, not paid
  excluded?: "Refunded" | "Cancelled" | null;
};

/**
 * Returns the commission orders represented by a payout request. Credit
 * ledger entries are used so an approved payout does not repeatedly list all
 * historical commissions. The order fallback keeps older requests usable if
 * their legacy wallet transactions do not have an orderId.
 */
export async function getPayoutStatementOrders(opts: {
  userId: string;
  userRole: Role;
  requestCreatedAt: Date;
  periodKey?: string | null;
}): Promise<PayoutStatementOrder[]> {
  const paid = await paidStatementOrders(opts);
  const unpaid = await unpaidPeriodOrders(opts, new Set(paid.map((o) => o.orderNumber)));
  return [...paid, ...unpaid].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Orders of the payout's month whose commission was not paid because the
 * whole order was refunded or cancelled (or refunds took back all of it).
 * Listed at $0 so the statement shows them without adding to the total.
 */
async function unpaidPeriodOrders(
  { userId, userRole, requestCreatedAt, periodKey }: { userId: string; userRole: Role; requestCreatedAt: Date; periodKey?: string | null },
  listed: Set<string>,
): Promise<PayoutStatementOrder[]> {
  if (!periodKey) return [];
  let period;
  try { period = periodFromKey(periodKey); } catch { return []; }
  const isPhysician = userRole === "PHYSICIAN";
  const end = requestCreatedAt < period.end ? requestCreatedAt : period.end;
  const orders = await prisma.order.findMany({
    where: {
      ...(isPhysician ? { physicianId: userId, physicianCommissionAmount: { gt: 0 } } : { salesRepId: userId, salesRepCommissionAmount: { gt: 0 } }),
      createdAt: { gte: period.start, lt: end },
    },
    select: {
      orderNumber: true, createdAt: true, status: true,
      salesRepCommissionAmount: true, salesRepCommissionRate: true, salesRepClawback: true,
      physicianCommissionAmount: true, physicianCommissionRate: true, physicianClawback: true,
    },
  });
  return orders.flatMap((o) => {
    if (listed.has(o.orderNumber)) return [];
    const left = isPhysician
      ? o.physicianCommissionAmount - (o.physicianClawback ?? 0)
      : o.salesRepCommissionAmount - (o.salesRepClawback ?? 0);
    const excluded = o.status === "CANCELLED" ? "Cancelled" as const
      : o.status === "REFUNDED" || left <= 0.004 ? "Refunded" as const
      : null;
    if (!excluded) return [];   // still to be paid in a later payout
    return [{
      orderNumber: o.orderNumber,
      createdAt:   o.createdAt,
      amount:      0,
      rate:        isPhysician ? o.physicianCommissionRate : o.salesRepCommissionRate,
      excluded,
    }];
  });
}

async function paidStatementOrders({
  userId,
  userRole,
  requestCreatedAt,
}: {
  userId: string;
  userRole: Role;
  requestCreatedAt: Date;
}): Promise<PayoutStatementOrder[]> {
  const previousPayout = await prisma.withdrawRequest.findFirst({
    where: {
      userId,
      userRole,
      status: "APPROVED",
      createdAt: { lt: requestCreatedAt },
      // A monthly request can be created at the snapshot time but approved
      // later. Such a payout must not become the lower bound for this
      // statement because its debit did not exist at the snapshot yet.
      updatedAt: { lte: requestCreatedAt },
    },
    select: { updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const after = previousPayout?.updatedAt ?? new Date(0);
  const ledger = await prisma.walletTransaction.findMany({
    where: {
      userId,
      userRole,
      type: { in: ["CREDIT", "DEBIT"] },
      // The request amount is a snapshot. Never allow later commissions or
      // debits to leak into an already-approved statement.
      createdAt: { gt: after, lte: requestCreatedAt },
    },
    select: { orderId: true, amount: true, type: true, description: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const orderIds = [...new Set(ledger.flatMap((entry) => entry.orderId ? [entry.orderId] : []))];
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          salesRepCommissionAmount: true,
          salesRepCommissionRate: true,
          physicianCommissionAmount: true,
          physicianCommissionRate: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const orderLedger = new Map<string, { amount: number; createdAt: Date; description: string | null }>();
  for (const entry of ledger) {
    if (!entry.orderId) continue;
    const current = orderLedger.get(entry.orderId) ?? {
      amount: 0,
      createdAt: entry.createdAt,
      description: entry.description,
    };
    current.amount += entry.type === "CREDIT" ? entry.amount : -entry.amount;
    current.createdAt = entry.createdAt;
    orderLedger.set(entry.orderId, current);
  }

  const statementOrders = orders.flatMap((order) => {
    const ledgerEntry = orderLedger.get(order.id);
    return ledgerEntry && ledgerEntry.amount > 0
      ? [{
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      amount: Number(ledgerEntry.amount.toFixed(2)),
      rate: userRole === "PHYSICIAN"
        ? order.physicianCommissionRate
        : order.salesRepCommissionRate,
      description: ledgerEntry.description,
    }]
      : [];
  });

  const adjustments = ledger
    .filter((entry) => !entry.orderId)
    .map((entry) => ({
      orderNumber: "Wallet adjustment",
      createdAt: entry.createdAt,
      amount: Number((entry.type === "CREDIT" ? entry.amount : -entry.amount).toFixed(2)),
      rate: 0,
      description: entry.description,
    }))
    .filter((entry) => entry.amount !== 0);

  if (statementOrders.length) {
    return [...statementOrders, ...adjustments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const legacyOrders = await prisma.order.findMany({
    where: {
      ...(userRole === "PHYSICIAN" ? { physicianId: userId } : { salesRepId: userId }),
      commissionPaid: true,
      createdAt: { gt: after, lt: requestCreatedAt },
    },
    select: {
      orderNumber: true,
      createdAt: true,
      salesRepCommissionAmount: true,
      salesRepCommissionRate: true,
      salesRepClawback: true,
      physicianCommissionAmount: true,
      physicianCommissionRate: true,
      physicianClawback: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // What was paid: the commission less what refunds took back
  const legacyStatementOrders = legacyOrders.map((order) => ({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    amount: Number(Math.max(0, userRole === "PHYSICIAN"
      ? order.physicianCommissionAmount - (order.physicianClawback ?? 0)
      : order.salesRepCommissionAmount - (order.salesRepClawback ?? 0)).toFixed(2)),
    rate: userRole === "PHYSICIAN"
      ? order.physicianCommissionRate
      : order.salesRepCommissionRate,
  }));

  return [...legacyStatementOrders, ...adjustments]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
