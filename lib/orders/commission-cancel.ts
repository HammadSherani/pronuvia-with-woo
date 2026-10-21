import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CommissionReview } from "@/generated/prisma/enums";
import { getWooOrder, updateWooOrder } from "@/lib/woo/orders";
import { REVIEW_META_KEY } from "./commission-review";
import { recordCommissionEvent } from "./commission-history";

const ROLES = [
  { key: "physician", role: "PHYSICIAN", review: "physicianCommissionReview", amount: "physicianCommissionAmount", note: "physician" },
  { key: "sales_rep", role: "SALES_REP", review: "salesRepCommissionReview", amount: "salesRepCommissionAmount", note: "salesRep" },
] as const;

const NOTE = "Order cancelled";

/**
 * The order was cancelled: its commission still awaiting review is rejected
 * ("Order cancelled", by Pronuvia), here, in the Commission History, and on the
 * WP order (so its Commissions box says rejected). Commission already reviewed
 * stays as it is.
 */
export async function rejectAwaitingCommission(orderId: string): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where:  { id: orderId },
    select: {
      wooOrderId: true, commissionReviewNotes: true,
      physicianId: true, physicianCommissionReview: true, physicianCommissionAmount: true,
      salesRepId: true, salesRepCommissionReview: true, salesRepCommissionAmount: true,
    },
  });
  const at = new Date();
  const notes = { ...((order.commissionReviewNotes as Record<string, unknown> | null) ?? {}) };
  const rejected: (typeof ROLES)[number][] = [];
  for (const r of ROLES) {
    if (order[r.review] !== CommissionReview.AWAITING) continue;
    // Only from awaiting: a review made at the same moment wins
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, [r.review]: CommissionReview.AWAITING },
      data:  { [r.review]: CommissionReview.REJECTED },
    });
    if (claimed.count !== 1) continue;
    rejected.push(r);
    notes[r.note] = { status: "rejected", amount: order[r.amount], note: NOTE, at: at.toISOString(), by: "Pronuvia" };
    await recordCommissionEvent({ key: `cancel:${orderId}:${r.role}`, orderId, userRole: r.role, action: "REJECTED", amount: order[r.amount], note: NOTE, by: "Pronuvia", createdAt: at });
  }
  if (!rejected.length) return;
  await prisma.order.update({ where: { id: orderId }, data: { commissionReviewNotes: notes as object } });

  // The WP Commissions box: rejected, with the reason
  if (!order.wooOrderId) return;
  try {
    const w = await getWooOrder(order.wooOrderId);
    const raw = w.meta_data.find((m) => m.key === REVIEW_META_KEY)?.value;
    let review: Record<string, Record<string, unknown>> = {};
    try { review = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {}; } catch { /* rebuilt below */ }
    for (const r of rejected) {
      // (not in its history: the Commission History row is written above)
      const e = review[r.key] ?? { amount: order[r.amount], original: order[r.amount] };
      review[r.key] = { ...e, status: "rejected", note: NOTE, at: at.toISOString(), by: "Pronuvia" };
    }
    await updateWooOrder(order.wooOrderId, { meta_data: [{ key: REVIEW_META_KEY, value: JSON.stringify(review) }] });
  } catch (e) {
    console.error(`[commission-cancel] could not mark the commission rejected on Woo order #${order.wooOrderId}:`, e);
  }
}
