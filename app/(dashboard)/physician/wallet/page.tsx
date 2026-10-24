import { requirePhysician } from "@/lib/auth/dal";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { PhysicianWalletPanel } from "@/components/physician/wallet-panel";
import { formatDate } from "@/lib/utils/timezone";
import { getCurrentPeriod, periodFromKey } from "@/lib/withdrawals/monthly";
import { MonthPicker } from "@/components/shared/month-picker";

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
  physicianCommissionRate: number | null;
  physicianCommissionAmount: number | null;
  physicianClawback: number | null;
  physicianCommissionReview: string | null;
  physicianCommissionOriginal: number | null;
  commissionReviewNotes: unknown;
};

// Commission left after refunds took part of it back
function netOf(o: OrderRow): number {
  if (o.physicianCommissionReview === "REJECTED") return 0;
  return Math.max(0, (o.physicianCommissionAmount ?? 0) - (o.physicianClawback ?? 0));
}

// The admin's note on this commission (WP order page review)
function reviewNoteOf(o: OrderRow): string | null {
  const n = (o.commissionReviewNotes as Record<string, { note?: string | null }> | null)?.["physician"];
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
                {o.physicianCommissionRate ?? 0}%
              </span>
            </td>
            <td className="px-5 py-4 text-right">
              <span className="text-sm font-bold text-gray-800">
                {fmt(netOf(o))}
              </span>
              {o.physicianCommissionReview === "AWAITING" && (
                <span className="block text-[11px] text-amber-600">Awaiting approval</span>
              )}
              {o.physicianCommissionOriginal != null && o.physicianCommissionOriginal !== o.physicianCommissionAmount && (
                <span className="block text-[11px] text-indigo-500">
                  <span className="line-through text-gray-400 mr-1">{fmt(o.physicianCommissionOriginal)}</span>
                  Modified{reviewNoteOf(o) ? `: ${reviewNoteOf(o)}` : ""}
                </span>
              )}
              {(o.physicianClawback ?? 0) > 0 && (
                <span className="block text-[11px] text-orange-500">
                  <span className="line-through text-gray-400 mr-1">{fmt(o.physicianCommissionAmount ?? 0)}</span>
                  −{fmt(o.physicianClawback ?? 0)} refunded
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-right">
              <Link href={`/physician/orders/${o.orderNumber}`}
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

export default async function PhysicianCommissionPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await requirePhysician();

  const [physician, earningOrders, withdrawRequests, adjustments] = await Promise.all([
    prisma.partneringPhysician.findUnique({
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
      where:   { physicianId: session.userId },
      select: {
        id:                        true,
        orderNumber:               true,
        createdAt:                 true,
        status:                    true,
        commissionPaid:            true,
        physicianCommissionRate:   true,
        physicianCommissionAmount: true,
        physicianClawback: true,
        physicianCommissionReview: true,
        physicianCommissionOriginal: true,
        commissionReviewNotes: true,
        commissionCreditedAt: true,
        returnedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.withdrawRequest.findMany({
      where:   { userId: session.userId, userRole: "PHYSICIAN" },
      orderBy: { createdAt: "desc" },
      take:    1,
      select:  { status: true },
    }),

    prisma.walletTransaction.findMany({
      where:   { userId: session.userId, userRole: "PHYSICIAN", description: { startsWith: "Admin " } },
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
    !o.commissionPaid && !CLOSED.has(o.status) && o.physicianCommissionReview === "AWAITING";
  const isRejected = (o: (typeof earningOrders)[number]) =>
    !isAwaiting(o) && (o.physicianCommissionReview === "REJECTED" || (!o.commissionPaid && CLOSED.has(o.status)) || ((o.physicianCommissionAmount ?? 0) > 0 && netOf(o) <= 0));
  const paidOrders     = earningOrders.filter((o) => !isRejected(o) && !isAwaiting(o) && o.commissionPaid);
  const reversedOrders = earningOrders.filter((o) => isRejected(o));
  // Commission the admin refunded on the WP order page after paying it: that
  // part shows under Rejected too (the rest stays approved)
  const refundedPart   = earningOrders.filter((o) => o.commissionPaid && o.physicianCommissionReview != null && !isRejected(o) && (o.physicianClawback ?? 0) > 0);
  const rejectedRows   = [
    ...reversedOrders.map((o) => ({ o, amount: o.physicianCommissionAmount ?? 0, adminRefund: o.commissionPaid && o.physicianCommissionReview != null && (o.physicianClawback ?? 0) > 0 })),
    ...refundedPart.map((o) => ({ o, amount: o.physicianClawback ?? 0, adminRefund: true })),
  ];
  // Pending: not yet in the wallet, including commission awaiting the admin's approval
  const pendingOrders  = earningOrders.filter((o) => !isRejected(o) && !o.commissionPaid);

  const totalPaid     = paidOrders.reduce((s, o)     => s + netOf(o), 0);
  const totalPending  = pendingOrders.reduce((s, o)  => s + netOf(o), 0);
  const totalWithdrawn = await prisma.withdrawRequest.aggregate({
    where: { userId: session.userId, userRole: "PHYSICIAN", status: "APPROVED" },
    _sum: { amount: true },
  }).then((r) => r._sum.amount ?? 0);

  // Prior refund clawbacks eat into upcoming pending commission before it's
  // actually withdrawable — net it out (unclamped, can go negative) so the
  // summary card shows what the physician will really end up with, not the
  // raw future order total.
  const deficit    = Math.max(0, -(physician?.walletBalance ?? 0));
  const netPending = totalPending - deficit;

  // ── One month at a time (?month=YYYY-MM, default this month) ──
  // Pending stays until the admin acts on it: this month shows every
  // pending commission, an older month its own still pending ones.
  // Approved shows in the month it went into the wallet, rejected in the
  // month it was rejected / cut, adjustments in their month.
  const tz      = process.env.PAYOUT_TIMEZONE ?? "UTC";
  const current = getCurrentPeriod(new Date(), tz);
  const { month } = await searchParams;
  let period = current;
  if (month) { try { period = periodFromKey(month); } catch { /* this month */ } }
  if (period.start > current.start) period = current;
  const isCurrent = period.key === current.key;
  const inMonth   = (d: Date) => d >= period.start && d < period.end;

  const cutEvents = rejectedRows.length
    ? await prisma.commissionEvent.findMany({
        where:   { orderId: { in: rejectedRows.map((r) => r.o.id) }, userRole: "PHYSICIAN", action: { in: ["REJECTED", "ORDER_REFUND", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        select:  { orderId: true, createdAt: true },
      })
    : [];
  const lastCut = new Map<string, Date>();
  for (const e of cutEvents) if (!lastCut.has(e.orderId)) lastCut.set(e.orderId, e.createdAt);
  const rejectedAt = (o: (typeof earningOrders)[number]) => {
    const at = (o.commissionReviewNotes as Record<string, { at?: string | null }> | null)?.["physician"]?.at;
    return lastCut.get(o.id) ?? (at && !Number.isNaN(Date.parse(at)) ? new Date(at) : null) ?? o.returnedAt ?? o.createdAt;
  };

  const monthPending     = pendingOrders.filter((o) => isCurrent || inMonth(o.createdAt));
  const monthApproved    = paidOrders.filter((o) => inMonth(o.commissionCreditedAt ?? o.createdAt));
  const monthRejected    = rejectedRows.filter((r) => inMonth(rejectedAt(r.o)));
  const monthAdjustments = adjustments.filter((a) => inMonth(a.createdAt));
  const monthPendingTotal  = monthPending.reduce((s, o) => s + netOf(o), 0);
  const monthApprovedTotal = monthApproved.reduce((s, o) => s + netOf(o), 0);
  const monthRejectedTotal = monthRejected.reduce((s, r) => s + r.amount, 0);

  // Months from the first order (or adjustment) to now, newest first
  const first = [...earningOrders.map((o) => o.createdAt), ...adjustments.map((a) => a.createdAt)]
    .reduce<Date>((min, d) => (d < min ? d : min), current.start);
  const months: { key: string; label: string }[] = [];
  for (let y = current.start.getUTCFullYear(), m = current.start.getUTCMonth(); ; m--) {
    if (m < 0) { m = 11; y--; }
    const p = periodFromKey(`${y}-${String(m + 1).padStart(2, "0")}`);
    months.push({ key: p.key, label: p.label });
    if (p.start <= first || months.length >= 120) break;
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-7 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Commission</h1>
          <p className="text-sm text-gray-500 mt-0.5">Commission for {period.label}</p>
        </div>
        <MonthPicker months={months} value={period.key} />
      </div>

      {/* Summary boxes hidden for now
      <PhysicianWalletPanel
        totalPending={netPending}
        totalWithdrawn={totalWithdrawn}
        commissionOrderCount={earningOrders.length}
        hasPending={hasPending}
        deficitApplied={Math.min(deficit, totalPending)}
        bankName={physician?.bankName}
        bankAccountNumber={physician?.bankAccountNumber}
        bankAccountName={physician?.bankAccountName}
      />
      */}

      {/* Pending Commission */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Pending Commission</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {monthPending.length}
          </span>
          <span className="text-[11px] text-gray-400">
            {isCurrent ? "all commission still awaiting review" : `${period.label} orders still awaiting review`}
          </span>
          {monthPending.length > 0 && (
            <span className="text-xs text-amber-600 font-medium ml-auto">
              {fmt(monthPendingTotal)} pending
            </span>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {monthPending.length === 0
            ? <EmptySection message="No pending commissions" />
            : <CommissionTable orders={monthPending} />
          }
        </div>
      </div>

      {/* Approved Commission (in the wallet, paid out from Commission Payout) */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Approved Commission — {period.label}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {monthApproved.length}
          </span>
          {monthApproved.length > 0 && (
            <span className="text-xs text-emerald-600 font-medium ml-auto">
              {fmt(monthApprovedTotal)} approved this month
            </span>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {monthApproved.length === 0
            ? <EmptySection message={`No commission approved in ${period.label}`} />
            : <CommissionTable orders={monthApproved} />
          }
        </div>
      </div>

      {/* Rejected Commission */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Rejected Commission — {period.label}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
            {monthRejected.length}
          </span>
          {monthRejected.length > 0 && (
            <span className="text-xs text-red-500 font-medium ml-auto">
              {fmt(monthRejectedTotal)} rejected this month
            </span>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {monthRejected.length === 0
            ? <EmptySection message={`No commission rejected in ${period.label}`} />
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
                  {monthRejected.map(({ o, amount, adminRefund }) => (
                    <tr key={`${o.id}-${adminRefund}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(rejectedAt(o))}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg line-through">
                          #{o.orderNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-xs font-semibold">
                          {o.physicianCommissionRate ?? 0}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-red-400 line-through">
                          {fmt(amount)}
                        </span>
                        {adminRefund && o.physicianCommissionReview !== "REJECTED" && (
                          <span className="block text-[11px] text-red-500 mt-0.5">Commission refunded by admin</span>
                        )}
                        {o.physicianCommissionReview === "REJECTED" && (
                          <span className="block text-[11px] text-red-500 mt-0.5">
                            Rejected by admin{reviewNoteOf(o) ? `: ${reviewNoteOf(o)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/physician/orders/${o.orderNumber}`}
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
                      <span className="text-sm font-black text-red-500">{fmt(monthRejectedTotal)}</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )
          }
        </div>
      </div>

      {/* Admin Wallet Adjustments */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-700">Admin Wallet Adjustments — {period.label}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            {monthAdjustments.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {monthAdjustments.length === 0
            ? <EmptySection message={`No admin adjustments in ${period.label}`} />
            : <AdjustmentTable adjustments={monthAdjustments} />
          }
        </div>
      </div>
    </div>
  );
}
