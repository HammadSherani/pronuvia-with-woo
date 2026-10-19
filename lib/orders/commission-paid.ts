import "server-only";
import { prisma } from "@/lib/db/prisma";
import { updateWooOrders } from "@/lib/woo/orders";
import { PAID_META_KEY, PAID_OUT_META_KEY } from "./commission-review";

/**
 * Tells the WP Commissions box that these orders' commission is in payout
 * (in the wallets); it can still be changed there until it is paid out.
 */
export async function markCommissionPaidInWoo(wooOrderIds: number[]): Promise<void> {
  for (let i = 0; i < wooOrderIds.length; i += 100) {
    const batch = wooOrderIds.slice(i, i + 100);
    try {
      await updateWooOrders(batch.map((id) => ({ id, meta_data: [{ key: PAID_META_KEY, value: "yes" }] })));
    } catch (e) {
      console.error("[commission-paid] could not mark orders paid in WooCommerce:", e);
    }
  }
}

/**
 * Tells the WP Commissions box which roles of these orders are paid out
 * (payout approved in Commission Payout): those rows no longer offer
 * approve / reject / modify, only "Refund commission". Best effort: Pronuvia
 * ignores changes to paid-out commission anyway.
 */
export async function markCommissionPaidOutInWoo(orderIds: string[]): Promise<void> {
  const orders = await prisma.order.findMany({
    where:  { id: { in: orderIds }, wooOrderId: { not: null } },
    select: { wooOrderId: true, physicianCommissionPaidOutAt: true, salesRepCommissionPaidOutAt: true },
  });
  const updates = orders.flatMap((o) => o.wooOrderId ? [{
    id: o.wooOrderId,
    meta_data: [{ key: PAID_OUT_META_KEY, value: JSON.stringify([
      ...(o.physicianCommissionPaidOutAt ? ["physician"] : []),
      ...(o.salesRepCommissionPaidOutAt ? ["sales_rep"] : []),
    ]) }],
  }] : []);
  for (let i = 0; i < updates.length; i += 100) {
    try {
      await updateWooOrders(updates.slice(i, i + 100));
    } catch (e) {
      console.error("[commission-paid] could not mark orders paid out in WooCommerce:", e);
    }
  }
}
