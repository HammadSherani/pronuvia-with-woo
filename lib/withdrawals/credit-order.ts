import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isApproved } from "@/lib/orders/commission-review";
import { markCommissionPaidInWoo } from "@/lib/orders/commission-paid";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";
import { upsertRunningPayoutRequest } from "@/lib/withdrawals/running-request";

/**
 * Puts an order's commission into the wallets as soon as the admin has
 * reviewed every commission on it (WP order page): approved roles get their
 * commission less any refund clawback, rejected ones nothing. The order is
 * then commissionPaid, so later refunds / cancellations claw back as before,
 * and each user's pending payout request grows to their wallet balance.
 * Does nothing while a commission still awaits review, or for a cancelled /
 * refunded order. Safe to call repeatedly: the commissionPaid claim makes it
 * credit once.
 */
export async function creditReviewedOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true, orderNumber: true, status: true, commissionPaid: true, wooOrderId: true,
      salesRepId: true, salesRepCommissionAmount: true, salesRepClawback: true, salesRepCommissionReview: true,
      physicianId: true, physicianCommissionAmount: true, physicianClawback: true, physicianCommissionReview: true,
    },
  });
  if (!order || order.commissionPaid) return false;
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return false;

  const roles = [
    { role: "SALES_REP" as const, id: order.salesRepId, amount: order.salesRepCommissionAmount, clawback: order.salesRepClawback, review: order.salesRepCommissionReview },
    { role: "PHYSICIAN" as const, id: order.physicianId, amount: order.physicianCommissionAmount, clawback: order.physicianClawback, review: order.physicianCommissionReview },
  ].filter((r) => r.id && r.amount > 0);
  // Only orders that go through review (older ones are paid by the monthly
  // run), and only once every commission on the order has been reviewed
  if (!roles.length || roles.every((r) => r.review == null)) return false;
  if (roles.some((r) => r.review === "AWAITING")) return false;

  // Claim the order first: a second call (webhook + page view) credits nothing
  const claimed = await prisma.order.updateMany({ where: { id: order.id, commissionPaid: false }, data: { commissionPaid: true } });
  if (claimed.count !== 1) return false;

  const period = getCurrentPeriod(new Date(), process.env.PAYOUT_TIMEZONE ?? "UTC");
  for (const r of roles) {
    const net = isApproved(r.review) ? Number(Math.max(0, r.amount - (r.clawback ?? 0)).toFixed(2)) : 0;
    if (net <= 0) continue;
    const model = (r.role === "PHYSICIAN" ? prisma.partneringPhysician : prisma.salesRepresentative) as unknown as typeof prisma.salesRepresentative;
    const { walletBalance } = await model.update({ where: { id: r.id! }, data: { walletBalance: { increment: net } }, select: { walletBalance: true } });
    const balance = Number(walletBalance.toFixed(2));
    if (balance !== walletBalance) await model.updateMany({ where: { id: r.id!, walletBalance }, data: { walletBalance: balance } });
    await prisma.walletTransaction.create({
      data: {
        userId: r.id!, userRole: r.role, amount: net, type: "CREDIT",
        description: `Commission for order #${order.orderNumber}`,
        orderId: order.id, periodKey: period.key, balance,
      },
    });
    await upsertRunningPayoutRequest(r.id!, r.role);
  }

  // The WP Commissions box stops offering approve / reject
  if (order.wooOrderId) await markCommissionPaidInWoo([order.wooOrderId]);
  return true;
}
