// One-time: orders cancelled / fully refunded before that rejected their
// commission get it now (still awaiting review → rejected, "Order cancelled" /
// "Order refunded").
//   tsx --conditions=react-server --env-file=.env scripts/reject-cancelled-commission.mts --dry
import { prisma } from "@/lib/db/prisma";
import { rejectAwaitingCommission } from "@/lib/orders/commission-cancel";

const dry = process.argv.includes("--dry");
const orders = await prisma.order.findMany({
  where:  { status: { in: ["CANCELLED", "REFUNDED"] }, OR: [{ physicianCommissionReview: "AWAITING" }, { salesRepCommissionReview: "AWAITING" }] },
  select: { id: true, orderNumber: true, status: true, physicianCommissionReview: true, salesRepCommissionReview: true },
});
for (const o of orders) {
  console.log(`${o.orderNumber} (${o.status}): doctor ${o.physicianCommissionReview ?? "-"}, rep ${o.salesRepCommissionReview ?? "-"} → rejected`);
  if (!dry) await rejectAwaitingCommission(o.id, o.status === "REFUNDED" ? "refunded" : "cancelled");
}
console.log(`${orders.length} order(s)${dry ? " (dry run: nothing changed)" : " done"}.`);
await prisma.$disconnect();
