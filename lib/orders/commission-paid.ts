import "server-only";
import { updateWooOrders } from "@/lib/woo/orders";
import { PAID_META_KEY } from "./commission-review";

/**
 * Tells the WP Commissions box that these orders' commission is paid, so it
 * no longer offers approve / reject / modify. Best effort: Pronuvia ignores
 * review changes on paid orders anyway.
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
