import Link from "next/link";
import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { formatDate, formatDateLong } from "@/lib/utils/timezone";


export const metadata = { title: "Dashboard – Pronuvia" };

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const APPROVAL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#ecfdf5", color: "#059669", label: "Approved" },
  PENDING:  { bg: "#fffbeb", color: "#d97706", label: "Pending"  },
  REJECTED: { bg: "#fef2f2", color: "#dc2626", label: "Rejected" },
};

export default async function SalesDashboardPage() {
  const session = await requireSalesRep();

  const [totalPhysicians, pendingPhysicians, rep, recentPhysicians, pendingCommissionOrders, totalPaidOut] = await Promise.all([
    prisma.partneringPhysician.count({ where: { salesRepId: session.userId } }),
    prisma.partneringPhysician.count({ where: { salesRepId: session.userId, isApproved: ApprovalStatus.PENDING } }),
    prisma.salesRepresentative.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, commission: true, ordersCount: true },
    }),
    prisma.partneringPhysician.findMany({
      where: { salesRepId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true, isApproved: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: {
        salesRepId: session.userId,
        commissionPaid: false,
        status: { notIn: ["REFUNDED", "CANCELLED"] },
      },
      select: { id: true, salesRepCommissionAmount: true },
    }),
    prisma.withdrawRequest.aggregate({
      where: { userId: session.userId, userRole: "SALES_REP", status: "APPROVED" },
      _sum: { amount: true },
    }).then((r) => r._sum.amount ?? 0),
  ]);

  const pendingRefundIds = new Set(
    (await prisma.orderRefund.findMany({
      where: { orderId: { in: pendingCommissionOrders.map((o) => o.id) } },
      select: { orderId: true },
    })).map((r) => r.orderId)
  );
  const totalPending = pendingCommissionOrders
    .filter((o) => !pendingRefundIds.has(o.id))
    .reduce((sum, o) => sum + (o.salesRepCommissionAmount ?? 0), 0);
  const totalCommission = totalPending + totalPaidOut;

  const kpiCards = [
    {
      label: "My Physicians",
      value: totalPhysicians.toString(),
      sub: "Total registered",
      href: "/sales/physicians",
      color: "#3DBFA4",
      bg: "#edfaf6",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: "Pending Approvals",
      value: pendingPhysicians.toString(),
      sub: pendingPhysicians > 0 ? "Awaiting review" : "All cleared",
      href: "/sales/physicians",
      color: pendingPhysicians > 0 ? "#d97706" : "#6b7280",
      bg:    pendingPhysicians > 0 ? "#fffbeb" : "#f3f4f6",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Commission Earned",
      value: fmtMoney(totalCommission),
      sub: "Current + paid out",
      href: "/sales/wallet",
      color: "#5BB8D4",
      bg: "#edf6fb",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Pending Commission",
      value: fmtMoney(totalPending),
      sub: "Awaiting payout",
      href: "/sales/wallet",
      color: "#10b981",
      bg: "#ecfdf5",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: "Commission Paid-out",
      value: fmtMoney(totalPaidOut),
      sub: "Approved payouts",
      href: "/sales/withdrawals",
      color: "#8b5cf6",
      bg: "#f5f3ff",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const today = formatDateLong(new Date(), { weekday: "long" });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1  gap-6 items-start">

        {/* ── LEFT: main content ── */}
        <div className="space-y-6 min-w-0">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Welcome back, {rep?.firstName ?? session.email}!
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">Here&apos;s an overview of your account activity.</p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm shrink-0">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium text-gray-600">{today}</span>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {kpiCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: card.bg }}
                >
                  <div style={{ color: card.color }}>{card.icon}</div>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800 tracking-tight">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Pending alert */}
          {pendingPhysicians > 0 && (
            <Link
              href="/sales/physicians"
              className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-2.194-.834-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">
                  {pendingPhysicians} physician approval{pendingPhysicians > 1 ? "s" : ""} pending
                </p>
                <p className="text-xs text-amber-600 mt-0.5">These physicians are waiting for admin approval.</p>
              </div>
              <svg className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {/* Recent Physicians table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-800">My Physicians</h3>
                <p className="text-xs text-gray-400 mt-0.5">Recently added</p>
              </div>
              <Link href="/sales/physicians" className="text-xs font-semibold text-[#3DBFA4] hover:underline">
                View All
              </Link>
            </div>
            {recentPhysicians.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">No physicians yet</p>
                <p className="text-xs text-gray-400 mt-1">Add your first physician to get started.</p>
                <Link
                  href="/sales/physicians"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Physician
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentPhysicians.map((p) => {
                    const s = APPROVAL_STYLE[p.isApproved] ?? APPROVAL_STYLE.PENDING;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="text-xs font-semibold text-gray-800">{p.firstName} {p.lastName}</p>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 truncate max-w-[200px]">{p.email}</td>
                        <td className="px-6 py-3.5 text-center">
                          <span
                            className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: s.bg, color: s.color }}
                          >
                            {s.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(p.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        
      </div>
    </div>
  );
}
