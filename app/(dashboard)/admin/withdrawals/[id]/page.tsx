import { notFound }  from "next/navigation";
import Link           from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma }      from "@/lib/db/prisma";
import { WithdrawalDetailActions } from "@/components/admin/withdrawal-detail-actions";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatDate, formatMonthYear } from "@/lib/utils/timezone";

export const metadata = { title: "Withdrawal Orders – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function parsePeriod(note: string | null, createdAt: Date): string {
  if (note) {
    const m = note.match(/Auto withdrawal\s*[–-]\s*(.+)/i);
    if (m) return m[1].trim();
  }
  return formatMonthYear(createdAt);
}

function extractProducts(items: unknown[]): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        const i = item as Record<string, unknown>;
        const title = i.title ?? i.name ?? i.productTitle ?? "";
        const qty   = i.quantity ?? i.qty ?? 1;
        return qty && Number(qty) > 1 ? `${title} ×${qty}` : String(title);
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: "Pending",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PROCESSING: { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  SHIPPED:    { label: "Shipped",    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  DELIVERED:  { label: "Delivered",  cls: "bg-teal-50 text-teal-700 border-teal-200" },
  COMPLETED:  { label: "Completed",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED:  { label: "Cancelled",  cls: "bg-gray-50 text-gray-500 border-gray-200" },
  REFUNDED:   { label: "Refunded",   cls: "bg-red-50 text-red-600 border-red-200" },
};

export default async function WithdrawalOrdersPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const request = await prisma.withdrawRequest.findUnique({ where: { id } });
  if (!request) notFound();

  const isRep = request.userRole === "SALES_REP";

  const [rep, physician] = await Promise.all([
    isRep
      ? prisma.salesRepresentative.findUnique({
          where:  { id: request.userId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : null,
    !isRep
      ? prisma.partneringPhysician.findUnique({
          where:  { id: request.userId },
          select: { id: true, firstName: true, lastName: true, email: true, nameOfPractice: true },
        })
      : null,
  ]);

  const user     = rep ?? physician;
  const userName = user ? `${user.firstName} ${user.lastName}` : "Unknown";
  const period   = parsePeriod(request.note, request.createdAt);

  // All commission orders for this user (newest first)
  const orders = isRep
    ? await prisma.order.findMany({
        where:   { salesRepId: request.userId, salesRepCommissionAmount: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, orderNumber: true, status: true, createdAt: true,
          total: true, shippingAddress: true, items: true,
          salesRepCommissionAmount: true, salesRepCommissionRate: true,
          commissionPaid: true,
        },
      })
    : await prisma.order.findMany({
        where:   { physicianId: request.userId, physicianCommissionAmount: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, orderNumber: true, status: true, createdAt: true,
          total: true, shippingAddress: true, items: true,
          physicianCommissionAmount: true, physicianCommissionRate: true,
          commissionPaid: true,
        },
      });

  const totalCommission = orders.reduce(
    (s, o) => s + (isRep
      ? ((o as { salesRepCommissionAmount?: number }).salesRepCommissionAmount ?? 0)
      : ((o as { physicianCommissionAmount?: number }).physicianCommissionAmount ?? 0)),
    0,
  );
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="max-w-6xl">
      {/* Back */}
      <Link
        href="/admin/withdrawals"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Commission Payouts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            isRep ? "bg-teal-50" : "bg-indigo-50"
          }`}>
            <span className={`text-lg font-bold ${isRep ? "text-[#3DBFA4]" : "text-indigo-600"}`}>
              {user ? `${user.firstName[0]}${user.lastName[0]}` : "?"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-gray-900">{userName}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isRep
                  ? "bg-teal-50 text-[#3DBFA4] border-teal-200"
                  : "bg-indigo-50 text-indigo-600 border-indigo-200"
              }`}>
                {isRep ? "Medical Rep" : "Doctor"}
              </span>
            </div>
            <p className="text-sm text-gray-400">{user?.email}</p>
            {!isRep && (physician as { nameOfPractice?: string | null } | null)?.nameOfPractice && (
              <p className="text-xs text-gray-400">{(physician as { nameOfPractice?: string | null })?.nameOfPractice}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-400">Payout request</p>
            <p className="text-lg font-black text-gray-800">{fmt(request.amount)}</p>
            <p className="text-xs text-gray-400">{period}</p>
          </div>
          {request.status === "PENDING" && (
            <WithdrawalDetailActions
              requestId={request.id}
              amount={request.amount}
              userName={userName}
              userEmail={user?.email ?? ""}
              period={period}
            />
          )}
          {request.status === "APPROVED" && (
            <span className="inline-flex px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
              Approved
            </span>
          )}
          {request.status === "REJECTED" && (
            <span className="inline-flex px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold">
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">Commission Orders</p>
          <p className="text-xl font-bold text-gray-800">{orders.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-gray-800">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">Total Commission</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(totalCommission)}</p>
        </div>
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
            <p className="text-sm text-gray-400">No commission orders found for this user</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product(s)</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => {
                const commAmt  = isRep
                  ? (order as { salesRepCommissionAmount?: number }).salesRepCommissionAmount ?? 0
                  : (order as { physicianCommissionAmount?: number }).physicianCommissionAmount ?? 0;
                const commRate = isRep
                  ? (order as { salesRepCommissionRate?: number }).salesRepCommissionRate ?? 0
                  : (order as { physicianCommissionRate?: number }).physicianCommissionRate ?? 0;
                const badge    = STATUS_BADGE[order.status] ?? { label: order.status, cls: "bg-gray-50 text-gray-500 border-gray-200" };
                const products = extractProducts(Array.isArray(order.items) ? order.items as unknown[] : []);

                return (
                  <tr key={order.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        #{order.orderNumber}
                      </span>
                      {order.commissionPaid && (
                        <span className="ml-1.5 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 border rounded-full text-[10px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 max-w-[220px]">
                      <span className="line-clamp-2" title={products}>{products}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-gray-800">
                      {fmt(order.total)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-sm font-bold text-emerald-600">{fmt(commAmt)}</p>
                      <p className="text-[10px] text-gray-400">{commRate}%</p>
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
