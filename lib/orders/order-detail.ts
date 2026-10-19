import "server-only";
import { prisma } from "@/lib/db/prisma";
import { refreshOrderFromWoo } from "./order-woo";
import { getCommissionHistory } from "./commission-history";

// The order detail a sales rep or physician sees for one of their orders:
// the order, its refunds, how much of each item was refunded, and the
// history of their own commission on it.

export type DetailItem = {
  title: string; variantSize?: string | null; sku?: string | null;
  unitPrice: number; quantity: number; lineTotal: number;
};
type StoredRefundItem = { index: number; returnedQty: number; lineTotal: number };

export async function getOwnOrderDetail(orderNumber: string, owner: { role: "SALES_REP" | "PHYSICIAN"; userId: string }) {
  const ownerField = owner.role === "SALES_REP" ? "salesRepId" : "physicianId";

  // Only the owner's order is brought up to date with WP admin changes
  const check = await prisma.order.findUnique({ where: { orderNumber }, select: { salesRepId: true, physicianId: true } });
  if (!check || check[ownerField] !== owner.userId) return null;
  await refreshOrderFromWoo({ orderNumber });

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      physician: { select: { firstName: true, lastName: true } },
      salesRep:  { select: { name: true } },
    },
  });
  if (!order || order[ownerField] !== owner.userId) return null;

  const refunds = await prisma.orderRefund.findMany({ where: { orderId: order.id }, orderBy: { processedAt: "asc" } });
  const items = order.items as unknown as DetailItem[];

  // Quantity and value refunded per item, over all refunds
  const refundedQty   = items.map(() => 0);
  const refundedValue = items.map(() => 0);
  for (const r of refunds) {
    const rItems = r.items as StoredRefundItem[] | null;
    if (!rItems) {
      items.forEach((it, i) => { refundedQty[i] = it.quantity; refundedValue[i] = it.lineTotal; });
    } else {
      for (const ri of rItems) {
        if (ri.index < 0 || ri.index >= items.length) continue;
        refundedQty[ri.index]   += ri.returnedQty;
        refundedValue[ri.index] += ri.lineTotal;
      }
    }
  }

  const commission = owner.role === "SALES_REP"
    ? { rate: order.salesRepCommissionRate,  amount: order.salesRepCommissionAmount,  clawback: order.salesRepClawback  ?? 0 }
    : { rate: order.physicianCommissionRate, amount: order.physicianCommissionAmount, clawback: order.physicianClawback ?? 0 };

  const history = await getCommissionHistory(order, [owner.role], { withBy: false });

  return { order, items, refunds, refundedQty, refundedValue, commission, history };
}

export type OwnOrderDetail = NonNullable<Awaited<ReturnType<typeof getOwnOrderDetail>>>;
