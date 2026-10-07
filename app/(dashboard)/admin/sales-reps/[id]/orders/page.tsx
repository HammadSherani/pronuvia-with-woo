import { notFound }             from "next/navigation";
import Link                      from "next/link";
import { requireAdmin }          from "@/lib/auth/dal";
import { getSalesRepById, getSalesRepOrders } from "@/actions/admin/manage-sales-reps";
import { Pagination }            from "@/components/shared/pagination";
import { parsePagination }       from "@/lib/pagination";
import { Suspense }              from "react";
import { formatDate }            from "@/lib/utils/timezone";

export const metadata = { title: "Medical Rep Orders – Pronuvia Admin" };

type Props = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  SHIPPED:    "bg-purple-50 text-purple-700 border-purple-200",
  COMPLETED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200",
  RETURNED:   "bg-gray-50 text-gray-600 border-gray-200",
};

const PAYMENT_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED:  "bg-red-50 text-red-700",
  REFUNDED:"bg-gray-50 text-gray-500",
};

export default async function SalesRepOrdersPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id }  = await params;
  const sp      = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const [rep, { orders, total }] = await Promise.all([
    getSalesRepById(id),
    getSalesRepOrders(id, { skip, take }),
  ]);

  if (!rep) notFound();

  const totalCommission = orders.reduce((s, o) => s + (o.salesRepCommissionAmount ?? 0), 0);

  return (
    <div className="max-w-6xl">
      {/* Back */}
      <Link
        href="/admin/sales-reps"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Medical Representatives
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#3DBFA4]/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-[#3DBFA4]">
              {rep.firstName[0]}{rep.lastName[0]}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{rep.name}</h1>
            <p className="text-sm text-gray-400">{rep.email} · {rep.commission}% commission</p>
          </div>
        </div>
        <Link
          href={`/admin/sales-reps/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300 transition-colors"
        >
          View Profile
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Orders",      value: String(total) },
          { label: "Total Revenue",     value: fmt(orders.reduce((s, o) => s + o.total, 0)) },
          { label: "Total Commission",  value: fmt(totalCommission) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400">No orders yet for this sales rep</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {["Order #", "Date", "Doctor", "Payment", "Status", "Total", "Commission"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => {
                  const status  = o.status  as string;
                  const payment = o.paymentStatus as string;
                  return (
                    <tr key={o.id} className="relative hover:bg-gray-50/80 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="absolute inset-0"
                          aria-label={`View order #${o.orderNumber}`}
                        />
                        <span className="font-mono text-xs font-semibold text-gray-700">
                          #{o.orderNumber}
                        </span>
                        {o.placedByAdmin && (
                          <span className="ml-1.5 text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {o.physician ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700">
                              {o.physician.firstName} {o.physician.lastName}
                            </p>
                            {o.physician.nameOfPractice && (
                              <p className="text-[10px] text-gray-400">{o.physician.nameOfPractice}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${PAYMENT_STYLES[payment] ?? "bg-gray-50 text-gray-500"}`}>
                          {payment}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 border rounded-full text-[10px] font-semibold ${STATUS_STYLES[status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-xs">
                        {fmt(o.total)}
                      </td>
                      <td className="px-4 py-3 text-xs text-emerald-700 font-medium">
                        {fmt(o.salesRepCommissionAmount ?? 0)}
                        <span className="text-gray-400 font-normal ml-1">
                          ({o.salesRepCommissionRate ?? 0}%)
                        </span>
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
