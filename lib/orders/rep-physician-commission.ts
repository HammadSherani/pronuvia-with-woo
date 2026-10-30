import "server-only";
import { prisma } from "@/lib/db/prisma";

// The rep dashboard's "Commission by physician": for each of the rep's
// physicians (and the rep's own orders), the orders in the period, their
// amount and the rep's commission on them, most commission first. Counted
// like the dashboard's Commission Earned: cancelled / fully refunded orders and
// rejected commission count nothing, and a partial refund takes its share off.

export type PhysicianCommissionRow = {
  physicianId: string | null;        // null = the rep's own orders
  name:        string;
  orders:      number;
  amount:      number;               // order totals after refunds
  commission:  number;               // the rep's commission after refunds
};

export async function getRepCommissionByPhysician(
  salesRepId: string,
  createdAt?: { gte?: Date; lte?: Date },
): Promise<PhysicianCommissionRow[]> {
  const [physicians, orders] = await Promise.all([
    prisma.partneringPhysician.findMany({
      where:  { salesRepId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.order.findMany({
      where: {
        salesRepId,
        status: { notIn: ["REFUNDED", "CANCELLED"] },
        ...(createdAt && { createdAt }),
      },
      select: {
        physicianId: true, total: true, returnedTotal: true,
        salesRepCommissionAmount: true, salesRepClawback: true, salesRepCommissionReview: true,
        physician: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const rows = new Map<string, PhysicianCommissionRow>();
  for (const p of physicians) {
    rows.set(p.id, { physicianId: p.id, name: `${p.firstName} ${p.lastName}`.trim(), orders: 0, amount: 0, commission: 0 });
  }
  for (const o of orders) {
    const key = o.physicianId ?? "self";
    let row = rows.get(key);
    if (!row) {
      // Own orders, or a physician since moved to another rep
      row = {
        physicianId: o.physicianId,
        name: o.physician ? `${o.physician.firstName} ${o.physician.lastName}`.trim() : "Your own orders",
        orders: 0, amount: 0, commission: 0,
      };
      rows.set(key, row);
    }
    row.orders += 1;
    row.amount += Math.max(0, o.total - (o.returnedTotal ?? 0));
    if (o.salesRepCommissionReview !== "REJECTED") {
      row.commission += Math.max(0, (o.salesRepCommissionAmount ?? 0) - (o.salesRepClawback ?? 0));
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return [...rows.values()]
    .map((r) => ({ ...r, amount: round(r.amount), commission: round(r.commission) }))
    .sort((a, b) => b.commission - a.commission || b.amount - a.amount || a.name.localeCompare(b.name));
}
