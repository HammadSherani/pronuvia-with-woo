import { requireSalesRep } from "@/lib/auth/dal";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { WalletPanel } from "@/components/sales/wallet-panel";
import { formatDate } from "@/lib/utils/timezone";

export const metadata = { title: "Commission – Pronuvia" };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

type OrderRow = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  salesRepCommissionRate: number | null;
  salesRepCommissionAmount: number | null;
  salesRepClawback: number | null;
  salesRepCommissionReview: string | null;
  salesRepCommissionOriginal: number | null;
  commissionReviewNotes: unknown;
};

// Commission left after refunds took part of it back
function netOf(o: OrderRow): number {
  if (o.salesRepCommissionReview === "REJECTED") return 0;
  return Math.max(0, (o.salesRepCommissionAmount ?? 0) - (o.salesRepClawback ?? 0));
}

// The admin's note on this commission (WP order page review)
function reviewNoteOf(o: OrderRow): string | null {
  const n = (o.commissionReviewNotes as Record<string, { note?: string | null }> | null)?.["salesRep"];
  return n?.note || null;
}

function CommissionTable({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) return null;
  return (
    <table className="w-full text-sm table-fixed">
      <colgroup>
        <col className="w-[18%]" />
        <col className="w-[24%]" />
        <col className="w-[18%]" />
        <col className="w-[26%]" />
        <col className="w-[14%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50/60">
          <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
          <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Number</th>
          <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission Rate</th>
          <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Earnings</th>
          <th className="px-5 py-3.5" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
            <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
              {formatDate(o.createdAt)}
            </td>
            <td className="px-5 py-4">
              <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                #{o.orderNumber}
              </span>
            </td>
            <td className="px-5 py-4 text-right">
              <span className="inline-flex px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-semibold">
                {o.salesRepCommissionRate ?? 0}%
              </span>
            </td>
            <td className="px-5 py-4 text-right">
              <span className="text-sm font-bold text-gray-800">
                {fmt(netOf(o))}
              </span>
              {o.salesRepCommissionReview === "AWAITING" && (
                <span className="block text-[11px] text-amber-600">Awaiting approval</span>
              )}
              {o.salesRepCommissionOriginal != null && o.salesRepCommissionOriginal !== o.salesRepCommissionAmount && (
                <span className="block text-[11px] text-indigo-500">
                  <span className="line-through text-gray-400 mr-1">{fmt(o.salesRepCommissionOriginal)}</span>
                  Modified{reviewNoteOf(o) ? `: ${reviewNoteOf(o)}` : ""}
                </span>
              )}
              {(o.salesRepClawback ?? 0) > 0 && (
                <span className="block text-[11px] text-orange-500">
                  <span className="line-through text-gray-400 mr-1">{fmt(o.salesRepCommissionAmount ?? 0)}</span>
                  −{fmt(o.salesRepClawback ?? 0)} refunded
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-right">
              <Link href={`/sales/orders/${o.orderNumber}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#3DBFA4] hover:text-[#35a993] whitespace-nowrap">
                View Order
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-gray-100 bg-gray-50/60">
          <td colSpan={3} className="px-5 py-3 text-xs font-bold text-gray-500 text-right">Total</td>
          <td className="px-5 py-3 text-right">
            <span className="text-sm font-black text-emerald-600">
              {fmt(orders.reduce((s, o) => s + netOf(o), 0))}
            </span>
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

type AdjustmentRow = {
  id:          string;
  amount:      number;
  type:        string;
  description: string | null;
  createdAt:   Date;
};

function AdjustmentTable({ adjustments }: { adjustments: AdjustmentRow[] }) {
  if (adjustments.length === 0) return null;
  return (
    <table className="w-full text-sm table-fixed">
      <colgroup>
        <col className="w-[20%]" />
        <col className="w-[50%]" />
        <col className="w-[30%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50/60">
          <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
          <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
          <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {adjustments.map((a) => {
          const note = a.description?.replace(/^Admin \[[^\]]*\]:\s*/, "") || "—";
          const isCredit = a.type === "CREDIT";
          return (
            <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                {formatDate(a.createdAt)}
              </td>
              <td className="px-5 py-4 text-sm text-gray-700">{note}</td>
              <td className="px-5 py-4 text-right">
                <span className={`text-sm font-bold ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
                  {isCredit ? "+" : "-"}{fmt(a.amount)}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function SalesCommissionPage() {
  const session = await requireSalesRep();

  const [rep, earningOrders, withdrawRequests, adjustments] = await Promise.all([
    prisma.salesRepresentative.findUnique({
      where:  { id: session.userId },
      select: {
        firstName:         true,
        lastName:          true,
        walletBalance:     true,
        bankName:          true,
        bankAccountNumber: true,
        bankAccountName:   true,
      },
    }),

    prisma.order.findMany({
      where:   { salesRepId: session.userId },
      select: {
        id:                        true,
        orderNumber:               true,
        createdAt:                 true,
        status:                    true,
        commissionPaid:            true,
        salesRepCommissionRate:    true,
        salesRepCommissionAmount:  true,
        salesRepClawback: true,
        salesRepCommissionReview: true,
        salesRepCommissionOriginal: true,
        commissionReviewNotes: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.withdrawRequest.findMany({
      where:   { userId: session.userId, userRole: "SALES_REP" },
      orderBy: { createdAt: "desc" },
      take:    1,
      select:  { status: true },
    }),

    prisma.walletTransaction.findMany({
      where:   { userId: session.userId, userRole: "SALES_REP", description: { startsWith: "Admin " } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, amount: true, type: true, description: true, createdAt: true },
    }),
  ]);

  const hasPending = withdrawRequests.some((r) => r.status === "PENDING");

  // Rejected: cancelled or refunded before the commission was paid, or its
  // whole commission taken back by refunds. A partly refunded order stays
  // pending / paid with the commission that is left.
  const CLOSED = new Set(["REFUNDED", "CANCELLED"]);
  // Awaiting: not yet approved by the admin (WP order page). Rejected also
  // covers commissions the admin rejected.
  const isAwaiting = (o: (typeof earningOrders)[number]) =>
    !o.commissionPaid && !CLOSED.has(o.status) && o.salesRepCommissionReview === "AWAITING";
  const isRejected = (o: (typeof earningOrders)[number]) =>
    !isAwaiting(o) && (o.salesRepCommissionReview === "REJECTED" || (!o.commissionPaid && CLOSED.has(o.status)) || ((o.salesRepCommissionAmount ?? 0) > 0 && netOf(o) <= 0));
  const paidOrders     = earningOrders.filter((o) => !isRejected(o) && !isAwaiting(o) && o.commissionPaid);
  const reversedOrders = earningOrders.filter((o) => isRejected(o));
  // Pending: not yet in the wallet, including commission awaiting the admin's approval
  const pendingOrders  = earningOrders.filter((o) => !isRejected(o) && !o.commissionPaid);

  const totalPaid     = paidOrders.reduce((s, o)     => s + netOf(o), 0);
  const totalPending  = pendingOrders.reduce((s, o)  => s + netOf(o), 0);
  const totalWithdrawn = await prisma.withdrawRequest.aggregate({
    where: { userId: session.userId, userRole: "SALES_REP", status: "APPROVED" },
    _sum: { amount: true },
  }).then((r) => r._sum.amount ?? 0);

  // Prior refund clawbacks eat into upcoming pending commission before it's
  // actually withdrawable — net it out (unclamped, can go negative) so the
  // summary card shows what the rep will really end up with, not the raw
  // future order total.
  const deficit    = Math.max(0, -(rep?.walletBalance ?? 0));
  const netPending = totalPending - deficit;

  return (
    <div className="max-w-6xl">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-gray-800">Commission</h1>
        <p className="text-sm text-gray-500 mt-0.5">Commission earnings by order</p>
      </div>

      <WalletPanel
        totalPending={netPending}
        totalWithdrawn={totalWithdrawn}
        commissionOrderCount={earningOrders.length}
        hasPending={hasPending}
        deficitApplied={Math.min(deficit, totalPending)}
        bankName={rep?.bankName}
        bankAccountNumber={rep?.bankAccountNumber}
        bankAccountName={rep?.bankAccountName}
      />

      {/* Pending Commission */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Pending Commission</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {pendingOrders.length}
          </span>
          {pendingOrders.length > 0 && (
            <span className="text-xs text-amber-600 font-medium ml-auto">
              {fmt(totalPending)} pending
            </span>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {pendingOrders.length === 0
            ? <EmptySection message="No pending commissions" />
            : <CommissionTable orders={pendingOrders} />
          }
        </div>
      </div>

      {/* Approved Commission (in the wallet, paid out from Commission Payout) */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Approved Commission</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {paidOrders.length}
          </span>
          {paidOrders.length > 0 && (
            <span className="text-xs text-emerald-600 font-medium ml-auto">
              {fmt(totalPaid)} in your wallet / paid out
            </span>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {paidOrders.length === 0
            ? <EmptySection message="No approved commissions yet" />
            : <CommissionTable orders={paidOrders} />
          }
        </div>
      </div>

      {/* Rejected Commission */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Rejected Commission</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
            {reversedOrders.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {reversedOrders.length === 0
            ? <EmptySection message="No rejected commissions" />
            : (
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[26%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Number</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission Rate</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Earnings</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reversedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg line-through">
                          #{o.orderNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-xs font-semibold">
                          {o.salesRepCommissionRate ?? 0}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-red-400 line-through">
                          {fmt(o.salesRepCommissionAmount ?? 0)}
                        </span>
                        {o.salesRepCommissionReview === "REJECTED" && (
                          <span className="block text-[11px] text-red-500 mt-0.5">
                            Rejected by admin{reviewNoteOf(o) ? `: ${reviewNoteOf(o)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/sales/orders/${o.orderNumber}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#3DBFA4] hover:text-[#35a993] whitespace-nowrap">
                          View Order
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      </div>

      {/* Admin Wallet Adjustments */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Admin Wallet Adjustments</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            {adjustments.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {adjustments.length === 0
            ? <EmptySection message="No admin adjustments" />
            : <AdjustmentTable adjustments={adjustments} />
          }
        </div>
      </div>
    </div>
  );
}
