import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma, Role } from "@/generated/prisma/client";

/**
 * A payout was approved: the commission it paid is paid out. Every order of
 * this user that was in payout up to the request's snapshot gets the paid-out
 * date for the role this user has on it; from then on its WP review is fixed
 * (only "Refund commission"). Runs inside the approval transaction, so a WP
 * change arriving after the approval can no longer move the wallet. Returns
 * the order ids (to tell WooCommerce).
 */
export async function lockPaidOutCommission(
  tx: Prisma.TransactionClient,
  request: { userId: string; userRole: Role; snapshotAt: Date | null },
): Promise<string[]> {
  const [userField, paidOutField, amountField] = request.userRole === "PHYSICIAN"
    ? ["physicianId", "physicianCommissionPaidOutAt", "physicianCommissionAmount"] as const
    : ["salesRepId", "salesRepCommissionPaidOutAt", "salesRepCommissionAmount"] as const;
  const upTo = request.snapshotAt ?? new Date();
  const orders = await tx.order.findMany({
    where: {
      [userField]: request.userId,
      commissionPaid: true,
      AND: [
        { OR: [{ commissionCreditedAt: { lte: upTo } }, { commissionCreditedAt: null }, { commissionCreditedAt: { isSet: false } }] },
        { OR: [{ [paidOutField]: null }, { [paidOutField]: { isSet: false } }] },
      ],
    },
    select: { id: true, [amountField]: true },
  });
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    await tx.order.updateMany({ where: { id: { in: ids } }, data: { [paidOutField]: new Date() } });
    // Commission history: "Paid out" on each order
    await tx.commissionEvent.createMany({
      data: orders.map((o) => ({
        key: `paid-out:${o.id}:${request.userRole}:${randomUUID()}`, orderId: o.id, userRole: request.userRole,
        action: "PAID_OUT", amount: Number((o as Record<string, unknown>)[amountField] ?? 0),
      })),
    });
  }
  return ids;
}
