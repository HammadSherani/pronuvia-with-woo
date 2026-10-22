// One-time, after the "Pronuvia Shipped Status" plugin is active in WP:
// orders that are Shipped here but "completed" in WooCommerce (from before
// Woo had a Shipped status) get the Woo status "shipped".
//   tsx --conditions=react-server --env-file=.env scripts/woo-shipped-status.mts --dry
import { prisma } from "@/lib/db/prisma";
import { getWooOrder, updateWooOrder } from "@/lib/woo/orders";

const dry = process.argv.includes("--dry");
const orders = await prisma.order.findMany({
  where:  { status: "SHIPPED", wooOrderId: { not: null } },
  select: { orderNumber: true, wooOrderId: true },
});
let n = 0;
for (const o of orders) {
  const w = await getWooOrder(o.wooOrderId!);
  if (w.status !== "completed") continue;
  console.log(`${o.orderNumber} (woo #${o.wooOrderId}): completed → shipped`);
  if (!dry) await updateWooOrder(o.wooOrderId!, { status: "shipped" });
  n++;
}
console.log(`${n} order(s)${dry ? " (dry run: nothing changed)" : " updated"}.`);
await prisma.$disconnect();
