import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/utils/timezone";

type Props = { params: Promise<{ id: string }> };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS_BADGE: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING:    { label: "Pending",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PROCESSING: { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  SHIPPED:    { label: "Shipped",    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  DELIVERED:  { label: "Delivered",  cls: "bg-teal-50 text-teal-700 border-teal-200" },
  COMPLETED:  { label: "Completed",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED:  { label: "Cancelled",  cls: "bg-gray-50 text-gray-500 border-gray-200" },
  REFUNDED:   { label: "Refunded",   cls: "bg-red-50 text-red-600 border-red-200" },
};

export default async function PhysicianOrdersPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const physician = await prisma.partneringPhysician.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, email: true, nameOfPractice: true },
  });
  if (!physician) notFound();

  const orders = await prisma.order.findMany({
    where: { physicianId: id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      subtotal: true,
      physicianCommissionAmount: true,
      commissionPaid: true,
      items: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalRevenue    = orders.reduce((s, o) => s + o.total, 0);
  const totalCommission = orders.reduce((s, o) => s + o.physicianCommissionAmount, 0);
  const paidCommission  = orders.filter(o => o.commissionPaid).reduce((s, o) => s + o.physicianCommissionAmount, 0);

  return (
    <div className="max-w-5xl">

      {/* Back */}
      <Link
        href="/admin/physicians"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Physicians
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#5BB8D4]/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-[#5BB8D4]">
            {physician.firstName[0]}{physician.lastName[0]}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {physician.firstName} {physician.lastName}
          </h1>
          <p className="text-sm text-gray-400">{physician.email}</p>
          {physician.nameOfPractice && (
            <p className="text-xs text-gray-400">{physician.nameOfPractice}</p>
          )}
        </div>
        <span className="ml-auto text-sm text-gray-400">
          {orders.length} order{orders.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Commission</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(totalCommission)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Commission Paid</p>
          <p className="text-xl font-bold text-blue-600">{fmt(paidCommission)}</p>
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No orders placed by this physician yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => {
                const badge = STATUS_BADGE[order.status];
                const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                return (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-semibold text-gray-800">#{order.orderNumber}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-800">
                      {fmt(order.total)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-600">
                          {fmt(order.physicianCommissionAmount)}
                        </span>
                        {order.commissionPaid ? (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Paid</span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Unpaid</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 border rounded-full text-[10px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8] transition-colors"
                      >
                        View
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
