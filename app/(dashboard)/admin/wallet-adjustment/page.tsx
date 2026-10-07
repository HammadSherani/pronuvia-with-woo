import { requireAdmin } from "@/lib/auth/dal";
import { prisma }        from "@/lib/db/prisma";
import { PageHeader }    from "@/components/admin/page-header";
import { AllWalletAdjustmentClient } from "@/components/admin/all-wallet-adjustment-client";
import { CommissionAdjustmentHistory, type AdjustmentEntry } from "@/components/admin/commission-adjustment-history";

export const metadata = { title: "Commission Adjustment – Pronuvia Admin" };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function WalletAdjustmentPage() {
  await requireAdmin();

  const [reps, physicians, rawTxns] = await Promise.all([
    prisma.salesRepresentative.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, walletBalance: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.partneringPhysician.findMany({
      where:   { isApproved: "APPROVED" },
      select: { id: true, firstName: true, lastName: true, email: true, walletBalance: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.walletTransaction.findMany({
      where:   { description: { startsWith: "Admin" } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, userId: true, userRole: true, amount: true, type: true, description: true, balance: true, createdAt: true },
    }),
  ]);

  // Resolve user names for all unique user IDs in history
  const repIds = [...new Set(rawTxns.filter((t) => t.userRole === "SALES_REP").map((t) => t.userId))];
  const drIds  = [...new Set(rawTxns.filter((t) => t.userRole === "PHYSICIAN").map((t) => t.userId))];
  const [histReps, histDrs] = await Promise.all([
    repIds.length ? prisma.salesRepresentative.findMany({ where: { id: { in: repIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
    drIds.length  ? prisma.partneringPhysician.findMany({ where: { id: { in: drIds  } }, select: { id: true, firstName: true, lastName: true } }) : [],
  ]);
  const nameMap = new Map<string, string>();
  histReps.forEach((r) => nameMap.set(r.id, `${r.firstName} ${r.lastName}`));
  histDrs.forEach((d)  => nameMap.set(d.id, `${d.firstName} ${d.lastName}`));

  function parseAdminTxn(desc: string | null): { adminEmail: string; note: string } {
    if (!desc) return { adminEmail: "Admin", note: "" };
    // new format: "Admin [email]: note"
    const m1 = desc.match(/^Admin \[(.+?)\]: (.+)$/);
    if (m1) return { adminEmail: m1[1], note: m1[2] };
    // legacy format: "Admin adjustment: note"
    const m2 = desc.match(/^Admin adjustment: (.+)$/);
    if (m2) return { adminEmail: "Admin", note: m2[1] };
    return { adminEmail: "Admin", note: desc };
  }

  const historyEntries: AdjustmentEntry[] = rawTxns.map((t) => {
    const { adminEmail, note } = parseAdminTxn(t.description);
    return {
      id:         t.id,
      userId:     t.userId,
      userRole:   t.userRole,
      userName:   nameMap.get(t.userId) ?? "Unknown User",
      amount:     t.amount,
      type:       t.type,
      adminEmail,
      note,
      balance:    t.balance,
      createdAt:  t.createdAt.toISOString(),
    };
  });

  const totalRepWallet = reps.reduce((s, r) => s + (r.walletBalance ?? 0), 0);
  const totalDrWallet  = physicians.reduce((s, p) => s + (p.walletBalance ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Commission Adjustment"
        description="Manually credit or debit Medical Rep and Physician commission balances"
      />

      <div className="grid grid-cols-4 gap-5 mb-6">
        {[
          { label: "Total Medical Reps",      value: reps.length,         color: "#3DBFA4", text: "text-[#3DBFA4]" },
          { label: "Rep Wallet Total",       value: fmt(totalRepWallet), color: "#3DBFA4", text: "text-[#3DBFA4]" },
          { label: "Total Doctors",          value: physicians.length,   color: "#6366f1", text: "text-indigo-600" },
          { label: "Doctor Wallet Total",    value: fmt(totalDrWallet),  color: "#6366f1", text: "text-indigo-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="w-8 h-1 rounded-full mb-3" style={{ background: c.color }} />
            <p className={`text-xl font-bold ${c.text}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <AllWalletAdjustmentClient reps={reps} physicians={physicians} />

      <CommissionAdjustmentHistory entries={historyEntries} />
    </div>
  );
}
