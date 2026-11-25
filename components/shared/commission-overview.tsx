import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { periodLabel } from "@/lib/commission/lines";
import { formatDate } from "@/lib/utils/timezone";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const r2 = (n: number) => Math.round(n * 100) / 100;
const KIND: Record<string, string> = {
  ORDER: "Commission", DEDUCTION: "Taken back (refund / cancellation after payout)", ADJUSTMENT: "Adjustment", OLD_SITE: "Commission (old site)",
};

/**
 * A doctor's or rep's commission (no wallet): what will be paid, month by
 * month and order by order; what still waits for the admin's approval; and
 * what was paid. Shared by /physician/wallet and /sales/wallet.
 */
export async function CommissionOverview({ userId, role }: { userId: string; role: "PHYSICIAN" | "SALES_REP" }) {
  const isDoc = role === "PHYSICIAN";
  const [lines, awaiting, paid, reviewSum] = await Promise.all([
    prisma.commissionLine.findMany({
      where:   { userId, userRole: role, status: "PENDING" },
      orderBy: [{ periodKey: "asc" }, { createdAt: "asc" }],
      select:  { id: true, orderNumber: true, kind: true, amount: true, note: true, periodKey: true, payoutId: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: isDoc
        ? { physicianId: userId, physicianCommissionAmount: { gt: 0 }, physicianCommissionReview: "AWAITING", status: { notIn: ["CANCELLED", "REFUNDED"] } }
        : { salesRepId: userId, salesRepCommissionAmount: { gt: 0 }, salesRepCommissionReview: "AWAITING", status: { notIn: ["CANCELLED", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, orderNumber: true, createdAt: true, physicianCommissionAmount: true, salesRepCommissionAmount: true },
    }),
    prisma.withdrawRequest.aggregate({ where: { userId, userRole: role, status: "APPROVED" }, _sum: { amount: true } }),
    prisma.commissionLine.aggregate({ where: { userId, userRole: role, status: "NEEDS_REVIEW" }, _sum: { amount: true } }),
  ]);

  // Upcoming payouts: the pending lines, grouped by the payout they are in
  const requestIds = [...new Set(lines.map((l) => l.payoutId).filter((x): x is string => !!x))];
  const requests = new Map((await prisma.withdrawRequest.findMany({ where: { id: { in: requestIds } }, select: { id: true, periodKey: true } })).map((r) => [r.id, r]));
  const groups = new Map<string, { period: string | null; lines: typeof lines }>();
  for (const l of lines) {
    const k = l.payoutId ?? `p:${l.periodKey}`;
    const g = groups.get(k) ?? { period: l.payoutId ? requests.get(l.payoutId)?.periodKey ?? l.periodKey : l.periodKey, lines: [] };
    g.lines.push(l);
    groups.set(k, g);
  }
  const payouts = [...groups.values()].sort((a, b) => (a.period ?? "").localeCompare(b.period ?? ""));
  const toPay = r2(lines.reduce((s, l) => s + l.amount, 0));
  const awaitingSum = r2(awaiting.reduce((s, o) => s + (isDoc ? o.physicianCommissionAmount : o.salesRepCommissionAmount), 0));
  const underReview = r2(reviewSum._sum.amount ?? 0);
  const base = isDoc ? "/physician" : "/sales";

  const cards = [
    { label: "To be paid", value: fmt(Math.max(0, toPay)), hint: "Approved commission in your upcoming payouts", color: "text-emerald-600" },
    { label: "Awaiting approval", value: fmt(awaitingSum), hint: `${awaiting.length} order${awaiting.length !== 1 ? "s" : ""} not reviewed yet`, color: "text-amber-600" },
    ...(underReview > 0 ? [{ label: "Under review", value: fmt(underReview), hint: "Older commission being checked by Pronuvia", color: "text-gray-700" }] : []),
    { label: "Paid in total", value: fmt(paid._sum.amount ?? 0), hint: "All payouts so far", color: "text-gray-800" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Commission</h1>
          <p className="text-sm text-gray-500 mt-0.5">Commission is paid month by month, for the orders of that month, once Pronuvia has approved it.</p>
        </div>
        <Link href={`${base}/withdrawals`} className="text-sm font-medium text-[#3DBFA4] hover:underline">Payout history →</Link>
      </div>

      <div className={`grid grid-cols-2 ${cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4 mb-8`}>
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{c.label}</p>
            <p className="text-xs text-gray-400 mt-1">{c.hint}</p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-bold text-gray-700 mb-3">Upcoming payouts</h2>
      {payouts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-10 text-center text-sm text-gray-400 mb-8">No approved commission waiting to be paid.</div>
      ) : (
        <div className="space-y-4 mb-8">
          {payouts.map((p) => {
            const total = r2(p.lines.reduce((s, l) => s + l.amount, 0));
            return (
              <div key={p.period ?? "none"} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                  <p className="text-sm font-semibold text-gray-800">{periodLabel(p.period)}</p>
                  <p className={`text-sm font-bold ${total < 0 ? "text-red-600" : "text-gray-900"}`}>{fmt(total)}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">What</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {p.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">{l.orderNumber ? `#${l.orderNumber}` : "—"}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{KIND[l.kind]}{l.note && (l.kind === "DEDUCTION" || l.kind === "ADJUSTMENT") ? <span className="block text-gray-400">{l.note}</span> : null}</td>
                        <td className={`px-5 py-3 text-right text-sm font-semibold ${l.amount < 0 ? "text-red-600" : "text-gray-800"}`}>{fmt(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total <= 0 && <p className="px-5 py-2.5 text-xs text-gray-500 bg-gray-50/60">This amount is taken off your next payout.</p>}
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-bold text-gray-700 mb-3">Awaiting approval</h2>
      {awaiting.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-10 text-center text-sm text-gray-400">Nothing waiting for approval.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {awaiting.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-gray-700">#{o.orderNumber}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-gray-800">{fmt(isDoc ? o.physicianCommissionAmount : o.salesRepCommissionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
