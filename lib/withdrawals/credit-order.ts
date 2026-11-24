import "server-only";
import { prisma } from "@/lib/db/prisma";
import { commissionNet } from "@/lib/orders/commission-review";
import { markCommissionPaidInWoo } from "@/lib/orders/commission-paid";
import { reconcileOrderCommission } from "@/lib/commission/lines";
import { recordCommissionEvent } from "@/lib/orders/commission-history";

/**
 * Puts an order's commission into Commission Payout as soon as the admin has
 * reviewed every commission on it (WP order page): approved roles get a
 * commission line (less any refund cut) in the payout of the order's month,
 * rejected ones nothing. The order is then commissionPaid ("in payout",
 * commissionCreditedAt). Until that payout is approved the review can still
 * change on WP (applyCommissionReview re-reconciles the line).
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
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, commissionPaid: false },
    data:  { commissionPaid: true, commissionCreditedAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  // Into Commission Payout: the order's commission lines, in the order's month
  await reconcileOrderCommission(order.id);
  for (const r of roles) {
    const net = commissionNet(r.review, r.amount, r.clawback);
    if (net <= 0) continue;
    await recordCommissionEvent({ key: `in-payout:${order.id}:${r.role}`, orderId: order.id, userRole: r.role, action: "IN_PAYOUT", amount: r.amount, walletChange: net });
  }

  // The WP Commissions box shows it in payout (still changeable until paid out)
  if (order.wooOrderId) await markCommissionPaidInWoo([order.wooOrderId]);
  return true;
}
