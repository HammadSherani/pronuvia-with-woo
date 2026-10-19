import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseReviewMeta } from "@/lib/orders/commission-review";
import { upsertRunningPayoutRequest } from "@/lib/withdrawals/running-request";
import { moveWalletForOrder } from "@/lib/withdrawals/wallet-move";
import { recordCommissionEvent } from "@/lib/orders/commission-history";

/**
 * Commission the admin took back on the WP order page ("Refund commission")
 * after the user's payout of it was approved (paid out). Each refund (by its WP id)
 * applies once: it comes off the wallet, which may go below zero, adds to the
 * order's clawback (so the remaining commission is what is left), and the
 * user's pending payout request follows the wallet. Never more than the
 * commission still standing on the order.
 */
export async function applyCommissionRefunds(orderId: string, raw: unknown): Promise<number> {
  const meta = parseReviewMeta(raw);
  if (!meta) return 0;
  let applied = 0;

  for (const [key, role, idField, amountField, clawField, paidOutField] of [
    ["physician", "PHYSICIAN", "physicianId", "physicianCommissionAmount", "physicianClawback", "physicianCommissionPaidOutAt"],
    ["sales_rep", "SALES_REP", "salesRepId", "salesRepCommissionAmount", "salesRepClawback", "salesRepCommissionPaidOutAt"],
  ] as const) {
    for (const r of meta[key]?.refunds ?? []) {
      const order = await prisma.order.findUniqueOrThrow({
        where:  { id: orderId },
        select: { orderNumber: true, commissionPaid: true, physicianId: true, salesRepId: true,
                  physicianCommissionAmount: true, physicianClawback: true, salesRepCommissionAmount: true, salesRepClawback: true,
                  physicianCommissionPaidOutAt: true, salesRepCommissionPaidOutAt: true },
      });
      const userId = order[idField];
      // Only once paid out: before that the admin rejects / modifies it instead
      if (!order.commissionPaid || !order[paidOutField] || !userId) continue;
      const left = Math.max(0, order[amountField] - (order[clawField] ?? 0));
      const amount = Number(Math.min(r.amount, left).toFixed(2));
      if (amount <= 0) continue;

      // Claim this refund first: a repeated webhook or page view applies it once
      const refundKey = `${orderId}:${key}:${r.id}`;
      if (await prisma.commissionRefund.findUnique({ where: { key: refundKey }, select: { id: true } })) continue;
      try {
        await prisma.commissionRefund.create({ data: { key: refundKey, orderId, userId, userRole: role, amount, note: r.note ?? null, by: r.by ?? null } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }

      await moveWalletForOrder({
        role, userId, orderId, delta: -amount,
        description: `Commission refunded — order #${order.orderNumber}${r.note ? ` (${r.note})` : ""}`,
      });
      // Set, not increment: an unset (null) clawback does not increment in MongoDB.
      // This refund is claimed above, so no other one adds to it at the same time.
      await prisma.order.update({ where: { id: orderId }, data: { [clawField]: Number(((order[clawField] ?? 0) + amount).toFixed(2)) } });
      await recordCommissionEvent({
        key: `refund:${refundKey}`, orderId, userRole: role, action: "REFUNDED",
        amount: Number((left - amount).toFixed(2)), previousAmount: left, walletChange: -amount,
        note: r.note, by: r.by, createdAt: r.at && !Number.isNaN(Date.parse(r.at)) ? new Date(r.at) : undefined,
      });
      await upsertRunningPayoutRequest(userId, role);
      applied++;
    }
  }
  return applied;
}
