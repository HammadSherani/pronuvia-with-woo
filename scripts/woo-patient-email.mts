// One-time: older Woo orders have the rep's / doctor's account email as the
// billing email ("Patient's Email address" in WP). Where the order has a
// patient email, the billing email becomes the patient's. A billing email
// changed by hand in WP is left alone (Pronuvia takes it over on refresh).
// Turn off WooCommerce's customer emails first (WP → Settings → Emails).
//   tsx --conditions=react-server --env-file=.env scripts/woo-patient-email.mts --dry
import { prisma } from "@/lib/db/prisma";
import { getWooOrder, updateWooOrder } from "@/lib/woo/orders";

const dry = process.argv.includes("--dry");
const orders = await prisma.order.findMany({
  where:  { wooOrderId: { not: null }, customerEmail: { not: null } },
  select: { orderNumber: true, wooOrderId: true, customerEmail: true, physician: { select: { email: true } }, salesRep: { select: { email: true } } },
  orderBy: { createdAt: "asc" },
});
let n = 0;
for (const o of orders) {
  const patient = o.customerEmail!.trim().toLowerCase();
  const w = await getWooOrder(o.wooOrderId!).catch(() => null);
  if (!w) continue;
  const billing = (w.billing?.email ?? "").trim().toLowerCase();
  const accounts = [o.physician?.email, o.salesRep?.email].filter(Boolean).map((e) => e!.toLowerCase());
  if (billing === patient || (billing && !accounts.includes(billing))) continue;
  console.log(`${o.orderNumber} (woo #${o.wooOrderId}): ${billing || "(empty)"} → ${patient}`);
  if (!dry) await updateWooOrder(o.wooOrderId!, { billing: { email: patient } });
  n++;
}
console.log(`${n} order(s)${dry ? " (dry run: nothing changed)" : " updated"}.`);
await prisma.$disconnect();
