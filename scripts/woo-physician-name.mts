// One-time: the doctor's name saved on WooCommerce orders (Commissions box,
// WP Orders list) without the "Dr. " in front, as new orders now have it.
//   tsx --conditions=react-server --env-file=.env scripts/woo-physician-name.mts --dry
import { prisma } from "@/lib/db/prisma";
import { getWooOrder, updateWooOrder } from "@/lib/woo/orders";
import { NAME_META_KEYS } from "@/lib/orders/commission-review";

const dry = process.argv.includes("--dry");
const orders = await prisma.order.findMany({
  where:  { wooOrderId: { not: null }, physicianId: { not: null } },
  select: { orderNumber: true, wooOrderId: true },
});
let n = 0;
for (const o of orders) {
  const w = await getWooOrder(o.wooOrderId!);
  const name = w.meta_data.find((m) => m.key === NAME_META_KEYS.physician)?.value;
  if (typeof name !== "string" || !name.startsWith("Dr. ")) continue;
  const clean = name.slice(4).trim();
  console.log(`${o.orderNumber} (woo #${o.wooOrderId}): "${name}" → "${clean}"`);
  if (!dry) await updateWooOrder(o.wooOrderId!, { meta_data: [{ key: NAME_META_KEYS.physician, value: clean }] });
  n++;
}
console.log(`${n} order(s)${dry ? " (dry run: nothing changed)" : " updated"}.`);
await prisma.$disconnect();
