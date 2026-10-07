import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/generated/prisma/enums";

export type PayoutStatementOrder = {
  orderNumber: string;
  createdAt: Date;
  amount: number;
  rate: number;
  description?: string | null;
};

/**
 * Returns the commission orders represented by a payout request. Credit
 * ledger entries are used so an approved payout does not repeatedly list all
 * historical commissions. The order fallback keeps older requests usable if
 * their legacy wallet transactions do not have an orderId.
 */
export async function getPayoutStatementOrders({
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
      physicianCommissionAmount: true,
      physicianCommissionRate: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const legacyStatementOrders = legacyOrders.map((order) => ({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    amount: userRole === "PHYSICIAN"
      ? order.physicianCommissionAmount
      : order.salesRepCommissionAmount,
    rate: userRole === "PHYSICIAN"
      ? order.physicianCommissionRate
      : order.salesRepCommissionRate,
  }));

  return [...legacyStatementOrders, ...adjustments]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
