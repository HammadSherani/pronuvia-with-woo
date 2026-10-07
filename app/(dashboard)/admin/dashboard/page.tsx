import { requireAdmin } from "@/lib/auth/dal";
import { getDashboardStats } from "@/actions/admin/dashboard";
import { DashboardChartsPanel } from "@/components/admin/dashboard-charts";
import { DashboardDateFilter } from "@/components/admin/dashboard-date-filter";
import { parseDateOnlyInTZ, formatDate, formatDateTime } from "@/lib/utils/timezone";
import Link from "next/link";

export const metadata = { title: "Admin Dashboard – Pronuvia" };

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_DOT: Record<string, string> = {
  PENDING:    "bg-amber-400",
  PROCESSING: "bg-blue-400",
  SHIPPED:    "bg-violet-400",
  DELIVERED:  "bg-emerald-400",
  COMPLETED:  "bg-teal-400",
  CANCELLED:  "bg-red-400",
  REFUNDED:   "bg-gray-400",
};

const APPROVAL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#ecfdf5", color: "#059669", label: "Approved" },
  PENDING:  { bg: "#fffbeb", color: "#d97706", label: "Pending"  },
  REJECTED: { bg: "#fef2f2", color: "#dc2626", label: "Rejected" },
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp   = await searchParams;
  const from = typeof sp.from === "string" && sp.from ? parseDateOnlyInTZ(sp.from) : undefined;
  const to   = typeof sp.to   === "string" && sp.to   ? parseDateOnlyInTZ(sp.to)   : undefined;

  const [, stats] = await Promise.all([
    requireAdmin(),
    getDashboardStats({ from, to }),
  ]);

  const { kpis, latestOrders, latestPhysicians } = stats;

  const kpiCards = [
    {
      label: "Gross Revenue",
      value: fmtMoney(kpis.totalRevenue),
      change: kpis.revenueChange,
      href: "/admin/orders",
      color: "#3DBFA4",
      bg: "#edfaf6",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Total Orders",
      value: kpis.totalOrders.toLocaleString(),
      change: kpis.ordersChange,
      href: "/admin/orders",
      color: "#5BB8D4",
      bg: "#edf6fb",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      label: "Partnering Physicians",
      value: kpis.physiciansCount.toLocaleString(),
      change: null as number | null,
      href: "/admin/physicians",
      color: "#8b5cf6",
      bg: "#f5f3ff",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      label: "Medical Representatives",
      value: kpis.salesRepsCount.toLocaleString(),
      change: null as number | null,
      href: "/admin/sales-reps",
      color: "#f59e0b",
      bg: "#fffbeb",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Pending Withdrawals",
      value: kpis.pendingWithdrawals.toLocaleString(),
      change: null as number | null,
      href: "/admin/withdrawals",
      color: kpis.pendingWithdrawals > 0 ? "#ef4444" : "#6b7280",
      bg:    kpis.pendingWithdrawals > 0 ? "#fef2f2" : "#f3f4f6",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  const fromStr = typeof sp.from === "string" ? sp.from : undefined;
  const toStr   = typeof sp.to   === "string" ? sp.to   : undefined;

  return (
    <div className="space-y-6">
      {/* ── Two-column outer grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_296px] gap-6 items-start">

        {/* ── LEFT: main content ── */}
        <div className="space-y-6 min-w-0">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Good Morning, Admin!</h1>
              <p className="text-sm text-gray-400 mt-0.5">Stay informed with live updates on your store&apos;s activity.</p>
            </div>
            <DashboardDateFilter from={fromStr} to={toStr} />
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {kpiCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: card.bg }}
                  >
                    <div style={{ color: card.color }}>{card.icon}</div>
                  </div>
                  {card.change !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      card.change >= 0
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-red-500 bg-red-50"
                    }`}>
                      {card.change >= 0 ? "+" : ""}{card.change}%
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800 tracking-tight">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Charts (Revenue & Orders + Status + Commission) */}
          <DashboardChartsPanel charts={stats.charts} />

          {/* Recent Orders table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Recent Orders</h3>
                <p className="text-xs text-gray-400 mt-0.5">Last 6 orders placed</p>
              </div>
              <Link href="/admin/orders" className="text-xs font-semibold text-[#3DBFA4] hover:underline">
                View All
              </Link>
            </div>
            {latestOrders.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No orders yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {latestOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                          #{o.orderNumber}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-xs font-semibold text-gray-700">{o.drName ?? o.repName ?? "—"}</p>
                        {o.drName && o.repName && (
                          <p className="text-[11px] text-gray-400">via {o.repName}</p>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-sm font-bold text-gray-800">{fmtMoney(o.total)}</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[o.status] ?? "bg-gray-400"}`} />
                          {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── RIGHT: activity sidebar ── */}
        <div className="space-y-5">

          {/* Pending withdrawal alert */}
          {kpis.pendingWithdrawals > 0 && (
            <Link
              href="/admin/withdrawals"
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-4 hover:bg-red-100 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-2.194-.834-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700">
                  {kpis.pendingWithdrawals} withdrawal{kpis.pendingWithdrawals > 1 ? "s" : ""} pending
                </p>
                <p className="text-xs text-red-500 mt-0.5">Tap to review and process</p>
              </div>
              <svg className="w-4 h-4 text-red-300 group-hover:text-red-500 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {/* Activity feed */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Recent Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest orders &amp; sign-ups</p>
            </div>
            <div className="divide-y divide-gray-50">
              {latestOrders.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">Order #{o.orderNumber}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {o.drName ?? o.repName ?? "—"} · {fmtMoney(o.total)}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      {formatDateTime(o.createdAt, { year: undefined })}
                    </p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATUS_DOT[o.status] ?? "bg-gray-400"}`} />
                </div>
              ))}

              {latestPhysicians.map((p) => {
                const s = APPROVAL_STYLE[p.isApproved] ?? APPROVAL_STYLE.PENDING;
                return (
                  <div key={p.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400">New physician sign-up</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        {formatDateTime(p.createdAt, { year: undefined })}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <Link href="/admin/physicians" className="text-xs font-semibold text-[#3DBFA4] hover:underline">
                View all physicians →
              </Link>
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Quick Access</h3>
            <div className="space-y-1">
              {[
                { label: "Manage Orders",     href: "/admin/orders",      color: "#3DBFA4" },
                { label: "Manage Physicians", href: "/admin/physicians",  color: "#8b5cf6" },
                { label: "Manage Medical Reps", href: "/admin/sales-reps",  color: "#f59e0b" },
                { label: "Withdrawals",       href: "/admin/withdrawals", color: "#5BB8D4" },
                { label: "Products",          href: "/admin/products",    color: "#10b981" },
                { label: "Coupons",           href: "/admin/coupons",     color: "#ec4899" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: link.color }} />
                  <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors flex-1">
                    {link.label}
                  </span>
                  <svg className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
