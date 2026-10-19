import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseReviewMeta } from "@/lib/orders/commission-review";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";
import { upsertRunningPayoutRequest } from "@/lib/withdrawals/running-request";

/**
 * Commission the admin took back on the WP order page ("Refund commission")
 * after it was approved and paid into the wallet. Each refund (by its WP id)
 * applies once: it comes off the wallet, which may go below zero, adds to the
 * order's clawback (so the remaining commission is what is left), and the
 * user's pending payout request follows the wallet. Never more than the
 * commission still standing on the order.
 */
export async function applyCommissionRefunds(orderId: string, raw: unknown): Promise<number> {
  const meta = parseReviewMeta(raw);
  if (!meta) return 0;
  let applied = 0;

  for (const [key, role, idField, amountField, clawField] of [
    ["physician", "PHYSICIAN", "physicianId", "physicianCommissionAmount", "physicianClawback"],
    ["sales_rep", "SALES_REP", "salesRepId", "salesRepCommissionAmount", "salesRepClawback"],
  ] as const) {
    for (const r of meta[key]?.refunds ?? []) {
      const order = await prisma.order.findUniqueOrThrow({
        where:  { id: orderId },
        select: { orderNumber: true, commissionPaid: true, physicianId: true, salesRepId: true,
                  physicianCommissionAmount: true, physicianClawback: true, salesRepCommissionAmount: true, salesRepClawback: true },
      });
      const userId = order[idField];
      if (!order.commissionPaid || !userId) continue;   // only once it is in the wallet
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

      const model = (role === "PHYSICIAN" ? prisma.partneringPhysician : prisma.salesRepresentative) as unknown as typeof prisma.salesRepresentative;
      const { walletBalance } = await model.update({ where: { id: userId }, data: { walletBalance: { increment: -amount } }, select: { walletBalance: true } });
      const balance = Number(walletBalance.toFixed(2));
      if (balance !== walletBalance) await model.updateMany({ where: { id: userId, walletBalance }, data: { walletBalance: balance } });
      await prisma.order.update({ where: { id: orderId }, data: { [clawField]: { increment: amount } } });
      await prisma.walletTransaction.create({
        data: {
          userId, userRole: role, amount, type: "DEBIT",
          description: `Commission refunded — order #${order.orderNumber}${r.note ? ` (${r.note})` : ""}`,
          orderId, periodKey: getCurrentPeriod(new Date(), process.env.PAYOUT_TIMEZONE ?? "UTC").key, balance,
        },
      });
      await upsertRunningPayoutRequest(userId, role);
      applied++;
    }
  }
  return applied;
}
