// One-time, at the deploy of "commission changeable until paid out":
// orders whose commission was already in the wallets before this release get
// commissionCreditedAt, and each role whose user has had a payout approved
// since then is marked paid out (here and in the WP Commissions box), so
// commission that was already paid can't be approved / rejected / modified
// again on WP. Commission still waiting in Commission Payout stays open.
//
//   tsx --conditions=react-server --env-file=.env scripts/backfill-commission-paid-out.mts --dry
//   tsx --conditions=react-server --env-file=.env scripts/backfill-commission-paid-out.mts
import { prisma } from "@/lib/db/prisma";
import { markCommissionPaidOutInWoo } from "@/lib/orders/commission-paid";

const dry = process.argv.includes("--dry");

const orders = await prisma.order.findMany({
  where:  { commissionPaid: true },
  select: {
    id: true, orderNumber: true, wooOrderId: true, updatedAt: true, commissionCreditedAt: true,
    physicianId: true, physicianCommissionPaidOutAt: true, salesRepId: true, salesRepCommissionPaidOutAt: true,
  },
  orderBy: { createdAt: "asc" },
});
const approved = await prisma.withdrawRequest.findMany({
  where:  { status: "APPROVED" },
  select: { userId: true, userRole: true, snapshotAt: true, createdAt: true, updatedAt: true },
});

const paidOut: string[] = [];
const rows: string[] = [];
for (const o of orders) {
  // When it went into the wallets: its first commission credit
  const credit = await prisma.walletTransaction.findFirst({
    where:   { orderId: o.id, type: "CREDIT", description: { startsWith: "Commission for order" } },
    orderBy: { createdAt: "asc" },
    select:  { createdAt: true },
  });
  const creditedAt = o.commissionCreditedAt ?? credit?.createdAt ?? o.updatedAt;
  const data: Record<string, Date> = {};
  if (!o.commissionCreditedAt) data.commissionCreditedAt = creditedAt;

  const marks: string[] = [];
  for (const [role, userId, field, already] of [
    ["PHYSICIAN", o.physicianId, "physicianCommissionPaidOutAt", o.physicianCommissionPaidOutAt],
    ["SALES_REP", o.salesRepId, "salesRepCommissionPaidOutAt", o.salesRepCommissionPaidOutAt],
  ] as const) {
    if (!userId || already) continue;
    // A payout approved for this user that covered this order (its snapshot is after the credit)
    const payout = approved
      .filter((r) => r.userId === userId && r.userRole === role && (r.snapshotAt ?? r.createdAt) >= creditedAt)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];
    if (!payout) continue;
    data[field] = payout.updatedAt;
    marks.push(role === "PHYSICIAN" ? "doctor" : "rep");
  }

  if (marks.length) paidOut.push(o.id);
  rows.push(`${o.orderNumber.padEnd(14)} woo #${String(o.wooOrderId ?? "-").padEnd(5)} credited ${creditedAt.toISOString().slice(0, 16)}  paid out: ${marks.join(", ") || "—"}`);
  if (!dry && Object.keys(data).length) await prisma.order.update({ where: { id: o.id }, data });
}

console.log(rows.join("\n"));
console.log(`\n${orders.length} orders in the wallets; ${paidOut.length} get a paid-out role; ${orders.length - paidOut.length} stay changeable on WP.`);
if (!dry && paidOut.length) await markCommissionPaidOutInWoo(paidOut);
console.log(dry ? "Dry run: nothing changed." : "Done.");
await prisma.$disconnect();
