import { requireAdmin }          from "@/lib/auth/dal";
import { prisma }               from "@/lib/db/prisma";
import { PageHeader }           from "@/components/admin/page-header";
import { CommissionHistoryClient } from "@/components/admin/commission-history-client";

export const metadata = { title: "Payout History – Pronuvia Admin" };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function CommissionHistoryPage() {
  await requireAdmin();

  // Only APPROVED requests — these are completed payouts
  const approved = await prisma.withdrawRequest.findMany({
    where:   { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    select:  { id: true, userId: true, userRole: true, amount: true, note: true, adminNote: true, createdAt: true },
  });

  const repIds = [...new Set(approved.filter((r) => r.userRole === "SALES_REP").map((r) => r.userId))];
  const docIds = [...new Set(approved.filter((r) => r.userRole === "PHYSICIAN").map((r) => r.userId))];

  const [reps, physicians] = await Promise.all([
    repIds.length
      ? prisma.salesRepresentative.findMany({
          where:  { id: { in: repIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [],
    docIds.length
      ? prisma.partneringPhysician.findMany({
          where:  { id: { in: docIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [],
  ]);

  const repMap = new Map(reps.map((r) => [r.id, r]));
  const docMap = new Map(physicians.map((p) => [p.id, p]));

  const [repOrders, docOrders] = await Promise.all([
    repIds.length
      ? prisma.order.findMany({
          where:   { salesRepId: { in: repIds }, salesRepCommissionAmount: { gt: 0 }, status: { notIn: ["REFUNDED", "CANCELLED"] } },
          select:  { salesRepId: true, orderNumber: true, createdAt: true, salesRepCommissionAmount: true, salesRepCommissionRate: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    docIds.length
      ? prisma.order.findMany({
          where:   { physicianId: { in: docIds }, physicianCommissionAmount: { gt: 0 }, status: { notIn: ["REFUNDED", "CANCELLED"] } },
          select:  { physicianId: true, orderNumber: true, createdAt: true, physicianCommissionAmount: true, physicianCommissionRate: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  type OrderRow = { orderNumber: string; createdAt: string; amount: number; rate: number };

  const repOrderMap = new Map<string, OrderRow[]>();
  const docOrderMap = new Map<string, OrderRow[]>();

  for (const o of repOrders) {
    const id  = o.salesRepId!;
    const arr = repOrderMap.get(id) ?? [];
    arr.push({ orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), amount: o.salesRepCommissionAmount ?? 0, rate: o.salesRepCommissionRate ?? 0 });
    repOrderMap.set(id, arr);
  }
  for (const o of docOrders) {
    const id  = o.physicianId!;
    const arr = docOrderMap.get(id) ?? [];
    arr.push({ orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(), amount: o.physicianCommissionAmount ?? 0, rate: o.physicianCommissionRate ?? 0 });
    docOrderMap.set(id, arr);
  }

  // One row per user — all payouts merged, all orders included
  const grouped = new Map<string, {
    id:          string;
    userRole:    "PHYSICIAN" | "SALES_REP";
    userId:      string;
    amount:      number;
    payoutCount: number;
    note:        string | null;
    adminNote:   string | null;
    createdAt:   string;
    user:        { firstName: string; lastName: string; email: string };
    orders:      OrderRow[];
  }>();

  for (const request of approved) {
    const user = request.userRole === "PHYSICIAN" ? docMap.get(request.userId) : repMap.get(request.userId);
    if (!user) continue;

    const key = `${request.userRole}:${request.userId}`;

    if (!grouped.has(key)) {
      // First time seeing this user — initialise with ALL their orders
      const allOrders = request.userRole === "PHYSICIAN"
        ? (docOrderMap.get(request.userId) ?? [])
        : (repOrderMap.get(request.userId) ?? []);

      grouped.set(key, {
        id:          request.id,
        userRole:    request.userRole as "PHYSICIAN" | "SALES_REP",
        userId:      request.userId,
        amount:      0,
        payoutCount: 0,
        note:        request.note,
        adminNote:   request.adminNote,
        createdAt:   request.createdAt.toISOString(),
        user:        { firstName: user.firstName, lastName: user.lastName, email: user.email },
        orders:      allOrders,
      });
    }

    const current = grouped.get(key)!;
    current.amount      += Number(request.amount || 0);
    current.payoutCount += 1;
    // Track most-recent payout date
    if (new Date(request.createdAt) > new Date(current.createdAt)) {
      current.createdAt = request.createdAt.toISOString();
    }
  }

  const rows = [...grouped.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPaid   = rows.reduce((s, r) => s + r.amount, 0);
  const repTotal    = rows.filter((r) => r.userRole === "SALES_REP").reduce((s, r) => s + r.amount, 0);
  const doctorTotal = rows.filter((r) => r.userRole === "PHYSICIAN").reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader
          title="Payout History"
        description="Record of all approved commission payouts"
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Paid Out", value: fmt(totalPaid),   color: "#3DBFA4", text: "text-[#3DBFA4]" },
          { label: "Medical Rep",    value: fmt(repTotal),    color: "#f59e0b", text: "text-amber-600" },
          { label: "Doctor",         value: fmt(doctorTotal), color: "#8b5cf6", text: "text-violet-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="w-8 h-1 rounded-full mb-3" style={{ background: c.color }} />
            <p className={`text-xl font-bold ${c.text}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <CommissionHistoryClient rows={rows} />
    </div>
  );
}
