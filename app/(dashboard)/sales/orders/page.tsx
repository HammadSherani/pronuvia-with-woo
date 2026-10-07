import Link from "next/link";
import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";
import { SalesDownloadOrdersButton } from "@/components/sales/download-orders-button";
import { formatDate } from "@/lib/utils/timezone";

export const metadata = { title: "Order – Pronuvia" };

const statusStyle: Record<OrderStatus, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  SHIPPED:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELIVERED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED:  "bg-teal-50 text-teal-700 border-teal-200",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200",
  REFUNDED:   "bg-gray-100 text-gray-600 border-gray-200",
};

const payStatusStyle: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED:  "bg-red-50 text-red-700 border-red-200",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSalesRep();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const where = { salesRepId: session.userId };
  const select = {
    id: true, orderNumber: true, createdAt: true,
    items: true, subtotal: true, total: true,
    shippingRate: true, shippingCarrier: true, trackingNumber: true,
    salesRepCommissionRate: true, salesRepCommissionAmount: true,
    status: true,
    paymentMethod: true, paymentStatus: true,
    transactionId: true,
    physicianId: true,
    physician: { select: { firstName: true, lastName: true } },
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, select, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.order.count({ where }),
  ]);

  // Stats from all orders (not paged)
  const [totalSpent, totalCommission, paidCount] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { total: true } }).then(r => r._sum.total ?? 0),
    prisma.order.aggregate({ where, _sum: { salesRepCommissionAmount: true } }).then(r => r._sum.salesRepCommissionAmount ?? 0),
    prisma.order.count({ where: { ...where, paymentStatus: "PAID" } }),
  ]);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Order</h1>
          <p className="text-sm text-gray-500 mt-0.5">All orders you have placed</p>
        </div>
        <div className="flex items-center gap-2">
          <SalesDownloadOrdersButton />
          <Link
            href="/sales/shop"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Order
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Orders",    value: String(total),        color: "#3DBFA4" },
          { label: "Total Spent",     value: fmt(totalSpent),      color: "#5BB8D4" },
          { label: "Your Commission", value: fmt(totalCommission), color: "#8b5cf6" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="w-8 h-1 rounded-full mb-3" style={{ background: c.color }} />
            <p className="text-xl font-bold text-gray-800">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No orders yet</p>
            <p className="text-xs text-gray-400 mb-5">Browse the shop and place your first order.</p>
            <Link
              href="/sales/shop"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors"
            >
              Browse Shop
            </Link>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                Orders <span className="text-gray-400 font-normal">({total})</span>
              </span>
              {paidCount > 0 && (
                <span className="text-xs text-gray-400">
                  {paidCount} paid · {total - paidCount} pending
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 text-nowrap py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Subtotal</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Shipping</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracking</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Origin</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => {
                  const itemCount = Array.isArray(o.items) ? o.items.length : 0;
                  const payStatus = o.paymentStatus ?? "PENDING";
                  const payCls    = payStatusStyle[payStatus] ?? payStatusStyle["PENDING"];
                  const stsCls    = statusStyle[o.status];
                  return (
                    <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-gray-700">
                        {o.orderNumber}
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-gray-700">{fmt(o.subtotal)}</td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {o.shippingRate > 0 ? fmt(o.shippingRate) : <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-800">{fmt(o.total)}</td>
                      <td className="px-5 py-4">
                        {o.trackingNumber ? (
                          <div>
                            <p className="text-xs text-gray-500">{o.shippingCarrier}</p>
                            <p className="text-xs font-mono font-semibold text-indigo-600 mt-0.5">{o.trackingNumber}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Awaiting shipment</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[#5BB8D4] font-semibold">{fmt(o.salesRepCommissionAmount)}</span>
                        <span className="text-xs text-gray-400 ml-1">({o.salesRepCommissionRate}%)</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2 py-0.5 border rounded-full text-xs font-medium ${stsCls}`}>
                          {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {o.physicianId ? (
                          <span className="text-xs text-indigo-600 font-medium">
                            {o.physician?.firstName} {o.physician?.lastName}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-medium">Myself</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/sales/invoice/${o.orderNumber}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#3DBFA4] hover:text-[#35a993] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Invoice
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Suspense>
              <Pagination total={total} page={page} pageSize={pageSize} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
