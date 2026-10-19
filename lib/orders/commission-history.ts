import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

// The commission history of an order, per role, for the order pages: every
// review on the WP order page (from the plugin's history in the review meta,
// or for older orders from its order notes), going into Commission Payout,
// the payout and commission refunds. One row per event (unique key), so a
// repeated webhook or page view writes nothing twice.

export type CommissionAction =
  | "APPROVED" | "REJECTED" | "PENDING" | "MODIFIED" | "IN_PAYOUT" | "ADJUSTED" | "PAID_OUT" | "REFUNDED";
type HistoryRole = "PHYSICIAN" | "SALES_REP";

export type CommissionEventInput = {
  key?:           string;
  orderId:        string;
  userRole:       HistoryRole;
  action:         CommissionAction;
  amount:         number;
  previousAmount?: number | null;
  walletChange?:  number | null;
  note?:          string | null;
  by?:            string | null;
  createdAt?:     Date;
};

/** Writes one event; null when its key was written already. */
export async function recordCommissionEvent(e: CommissionEventInput): Promise<{ id: string } | null> {
  const key = e.key ?? randomUUID();
  if (e.key && await prisma.commissionEvent.findUnique({ where: { key }, select: { id: true } })) return null;
  try {
    return await prisma.commissionEvent.create({
      data: {
        key, orderId: e.orderId, userRole: e.userRole, action: e.action,
        amount: e.amount, previousAmount: e.previousAmount ?? null,
        walletChange: e.walletChange ? Number(e.walletChange.toFixed(2)) : null,
        note: e.note || null, by: e.by || null, ...(e.createdAt && { createdAt: e.createdAt }),
      },
      select: { id: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

export type CommissionHistoryRow = {
  id: string; role: HistoryRole; action: CommissionAction | "EARNED";
  amount: number; previousAmount: number | null; walletChange: number | null;
  note: string | null; by: string | null; at: Date;
};

/**
 * The history of these roles' commission on the order, oldest first,
 * starting with what the order earned. `withBy` = show the WP admin's name
 * (admins only).
 */
export async function getCommissionHistory(
  order: {
    id: string; createdAt: Date;
    physicianId?: string | null; salesRepId?: string | null;
    physicianCommissionAmount: number; physicianCommissionOriginal?: number | null;
    salesRepCommissionAmount: number;  salesRepCommissionOriginal?: number | null;
  },
  roles: HistoryRole[],
  opts: { withBy: boolean },
): Promise<CommissionHistoryRow[]> {
  const events = await prisma.commissionEvent.findMany({
    where:   { orderId: order.id, userRole: { in: roles } },
    orderBy: { createdAt: "asc" },
  });
  const earned: CommissionHistoryRow[] = roles.flatMap((role) => {
    const [user, amount, original] = role === "PHYSICIAN"
      ? [order.physicianId, order.physicianCommissionAmount, order.physicianCommissionOriginal]
      : [order.salesRepId, order.salesRepCommissionAmount, order.salesRepCommissionOriginal];
    // The first event's previous amount, else the kept original, is what the order earned
    const first = events.find((e) => e.userRole === role && e.previousAmount != null);
    const value = original ?? first?.previousAmount ?? amount;
    return user && value > 0
      ? [{ id: `earned-${role}`, role, action: "EARNED" as const, amount: value, previousAmount: null, walletChange: null, note: null, by: null, at: order.createdAt }]
      : [];
  });
  return [
    ...earned,
    ...events.map((e) => ({
      id: e.id, role: e.userRole as HistoryRole, action: e.action as CommissionAction,
      amount: e.amount, previousAmount: e.previousAmount, walletChange: e.walletChange,
      note: e.note, by: opts.withBy ? e.by : null, at: e.createdAt,
    })),
  ];
}
