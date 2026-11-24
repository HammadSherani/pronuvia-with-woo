import { requireAdmin } from "@/lib/auth/dal";
import { prisma }        from "@/lib/db/prisma";
import { PageHeader }    from "@/components/admin/page-header";
import { CommissionAdjustmentClient, type AdjustmentRow } from "@/components/admin/commission-adjustment-client";
import { CommissionAdjustmentHistory, type AdjustmentEntry } from "@/components/admin/commission-adjustment-history";
import { periodLabel } from "@/lib/commission/lines";

export const metadata = { title: "Commission Adjustment – Pronuvia Admin" };

// Commission Adjustment: every adjustment is on an order and goes into that
// person's payout for the order's month (lib/commission/adjustments). The
// adjustments made on the old wallet stay listed below, read-only.
export default async function CommissionAdjustmentPage() {
  await requireAdmin();

  const [reps, physicians, lines, legacy] = await Promise.all([
    prisma.salesRepresentative.findMany({ select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: "asc" } }),
    prisma.partneringPhysician.findMany({ where: { isApproved: "APPROVED" }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: "asc" } }),
    prisma.commissionLine.findMany({
      where:   { kind: "ADJUSTMENT" },
      orderBy: { createdAt: "desc" },
      select:  { id: true, userId: true, userRole: true, orderNumber: true, periodKey: true, amount: true, note: true, by: true, status: true, createdAt: true },
    }),
    prisma.walletTransaction.findMany({
      where:   { description: { startsWith: "Admin" } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, userId: true, userRole: true, amount: true, type: true, description: true, balance: true, createdAt: true },
    }),
  ]);

  const people = [
    ...physicians.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, role: "PHYSICIAN" as const })),
    ...reps.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`, email: r.email, role: "SALES_REP" as const })),
  ];
  const who = new Map(people.map((p) => [`${p.id}:${p.role}`, p]));
  // People no longer in the lists (e.g. a doctor not approved any more)
  const missing = [...new Set([...lines, ...legacy].map((l) => `${l.userId}:${l.userRole}`))].filter((k) => !who.has(k));
  if (missing.length) {
    const ids = (role: string) => missing.filter((k) => k.endsWith(`:${role}`)).map((k) => k.split(":")[0]);
    const [d, r] = await Promise.all([
      prisma.partneringPhysician.findMany({ where: { id: { in: ids("PHYSICIAN") } }, select: { id: true, firstName: true, lastName: true, email: true } }),
      prisma.salesRepresentative.findMany({ where: { id: { in: ids("SALES_REP") } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    ]);
    for (const p of d) who.set(`${p.id}:PHYSICIAN`, { id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, role: "PHYSICIAN" });
    for (const p of r) who.set(`${p.id}:SALES_REP`, { id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, role: "SALES_REP" });
  }

  const rows: AdjustmentRow[] = lines.map((l) => {
    const p = who.get(`${l.userId}:${l.userRole}`);
    return {
      id: l.id, userName: p?.name ?? "Unknown", userEmail: p?.email ?? "", role: l.userRole as AdjustmentRow["role"],
      orderNumber: l.orderNumber, period: periodLabel(l.periodKey), amount: l.amount, reason: l.note, by: l.by,
      status: l.status, createdAt: l.createdAt.toISOString(),
    };
  });

  const legacyEntries: AdjustmentEntry[] = legacy.map((t) => {
    const m = t.description?.match(/^Admin \[(.+?)\]: (.+)$/) ?? null;
    return {
      id: t.id, userId: t.userId, userRole: t.userRole, userName: who.get(`${t.userId}:${t.userRole}`)?.name ?? "Unknown User",
      amount: t.amount, type: t.type, adminEmail: m?.[1] ?? "Admin", note: m?.[2] ?? (t.description ?? "").replace(/^Admin adjustment: /, ""),
      balance: t.balance, createdAt: t.createdAt.toISOString(),
    };
  });

  return (
    <div>
      <PageHeader
        title="Commission Adjustment"
        description="Add or deduct commission on an order. It is paid with that person's payout for the order's month."
      />
      <CommissionAdjustmentClient people={people} rows={rows} />
      {legacyEntries.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Earlier wallet adjustments</h2>
          <p className="text-xs text-gray-500 mb-3">Made before the wallet was removed. Shown for reference only.</p>
          <CommissionAdjustmentHistory entries={legacyEntries} />
        </>
      )}
    </div>
  );
}
