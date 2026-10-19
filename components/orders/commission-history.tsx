import { formatDateTime } from "@/lib/utils/timezone";
import type { CommissionHistoryRow } from "@/lib/orders/commission-history";

// The order's commission history (admin, sales rep and physician order pages)

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const ACTIONS: Record<CommissionHistoryRow["action"], { label: string; style: string }> = {
  EARNED:    { label: "Earned",                     style: "bg-gray-100 text-gray-600" },
  PENDING:   { label: "Set to pending",             style: "bg-amber-50 text-amber-700" },
  APPROVED:  { label: "Approved",                   style: "bg-emerald-50 text-emerald-700" },
  REJECTED:  { label: "Rejected",                   style: "bg-red-50 text-red-600" },
  MODIFIED:  { label: "Modified",                   style: "bg-blue-50 text-blue-700" },
  IN_PAYOUT: { label: "Added to Commission Payout", style: "bg-teal-50 text-teal-700" },
  ADJUSTED:  { label: "Wallet adjusted",            style: "bg-indigo-50 text-indigo-700" },
  PAID_OUT:  { label: "Paid out",                   style: "bg-violet-50 text-violet-700" },
  REFUNDED:  { label: "Commission refunded",        style: "bg-orange-50 text-orange-700" },
};

export function CommissionHistory({ rows, showRole, showBy }: {
  rows:     CommissionHistoryRow[];
  showRole: boolean;   // admin: doctor and rep in one table
  showBy:   boolean;   // admin: which WP admin did it
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center">
        <h3 className="text-sm font-semibold text-gray-700">Commission History</h3>
        <span className="ml-auto text-[11px] text-gray-400 font-medium">{rows.length} event{rows.length !== 1 ? "s" : ""}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-xs text-gray-400 text-center">No commission on this order.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {["Date", ...(showRole ? ["Commission of"] : []), "Action", "Commission", "Wallet", "Note", ...(showBy ? ["By"] : [])].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const a = ACTIONS[r.action];
                return (
                  <tr key={r.id}>
                    <td className="pl-5 pr-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(r.at)}</td>
                    {showRole && <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.role === "PHYSICIAN" ? "Doctor" : "Sales Rep"}</td>}
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${a.style}`}>{a.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
                      {r.previousAmount != null && r.previousAmount !== r.amount
                        ? <><span className="text-gray-400 line-through font-normal">{money(r.previousAmount)}</span> → {money(r.amount)}</>
                        : money(r.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap">
                      {r.walletChange
                        ? <span className={r.walletChange > 0 ? "text-emerald-600" : "text-red-500"}>{r.walletChange > 0 ? "+" : "−"}{money(Math.abs(r.walletChange))}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.note || <span className="text-gray-300">—</span>}</td>
                    {showBy && <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.by || <span className="text-gray-300">—</span>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
