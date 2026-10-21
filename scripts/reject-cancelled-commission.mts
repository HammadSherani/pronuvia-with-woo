// One-time: orders cancelled before cancelling rejected their commission get
// it now (commission still awaiting review → rejected, "Order cancelled").
//   tsx --conditions=react-server --env-file=.env scripts/reject-cancelled-commission.mts --dry
import { prisma } from "@/lib/db/prisma";
import { rejectAwaitingCommission } from "@/lib/orders/commission-cancel";

const dry = process.argv.includes("--dry");
const orders = await prisma.order.findMany({
  where:  { status: "CANCELLED", OR: [{ physicianCommissionReview: "AWAITING" }, { salesRepCommissionReview: "AWAITING" }] },
  select: { id: true, orderNumber: true, physicianCommissionReview: true, salesRepCommissionReview: true },
});
for (const o of orders) {
  console.log(`${o.orderNumber}: doctor ${o.physicianCommissionReview ?? "-"}, rep ${o.salesRepCommissionReview ?? "-"} → rejected`);
  if (!dry) await rejectAwaitingCommission(o.id);
}
console.log(`${orders.length} cancelled order(s)${dry ? " (dry run: nothing changed)" : " done"}.`);
await prisma.$disconnect();
