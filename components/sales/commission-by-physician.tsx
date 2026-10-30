import { Suspense } from "react";
import { getRepCommissionByPhysician } from "@/lib/orders/rep-physician-commission";
import { parseOrdersRange } from "@/lib/orders/date-range";
import { OrdersDateFilter } from "@/components/shared/orders-date-filter";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Rep dashboard: commission per physician in the chosen period, most first. */
export async function CommissionByPhysician({ salesRepId, sp }: {
  salesRepId: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const dr   = parseOrdersRange(sp);
  const rows = await getRepCommissionByPhysician(salesRepId, dr.createdAt);

  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalOrders     = rows.reduce((s, r) => s + r.orders, 0);
  const totalAmount     = rows.reduce((s, r) => s + r.amount, 0);
  const top             = rows[0]?.commission > 0 ? rows[0] : null;
  const max             = Math.max(...rows.map((r) => r.commission), 0);

  const kpis = [
    { label: "Commission in period", value: money(totalCommission), color: "#8b5cf6" },
    { label: "Orders",               value: String(totalOrders),     color: "#3DBFA4" },
    { label: "Order amount",         value: money(totalAmount),      color: "#5BB8D4" },
    { label: "Top physician",        value: top ? top.name : "—",    color: "#d97706", sub: top ? money(top.commission) : "No commission yet" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Commission by Physician</h3>
          <p className="text-xs text-gray-400 mt-0.5">Your commission from each physician&apos;s orders</p>
        </div>
        <Suspense>
          <OrdersDateFilter range={dr.range} from={dr.from} to={dr.to}
            presets={["today", "week", "month", "6-months", "all", "custom"]} />
        </Suspense>
      </div>

      {/* Period KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white px-6 py-4">
            <div className="w-6 h-1 rounded-full mb-2" style={{ background: k.color }} />
            <p className="text-lg font-bold text-gray-800 truncate">{k.value}</p>
            <p className="text-xs text-gray-500">{k.label}</p>
            {k.sub && <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-400">No physicians yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["#", "Physician", "Orders", "Order amount", "Your commission"].map((h, i) => (
                  <th key={h} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <tr key={r.physicianId ?? "self"} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-xs text-gray-400 w-10">{i + 1}</td>
                  <td className="px-6 py-3.5">
                    <p className="text-xs font-semibold text-gray-800">{r.name}</p>
                    {/* Share of the period's top commission */}
                    <div className="mt-1.5 h-1.5 w-40 max-w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#8b5cf6]" style={{ width: `${max > 0 ? (r.commission / max) * 100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right text-xs text-gray-600">{r.orders}</td>
                  <td className="px-6 py-3.5 text-right text-xs text-gray-600">{money(r.amount)}</td>
                  <td className={`px-6 py-3.5 text-right text-sm font-bold ${r.commission > 0 ? "text-gray-800" : "text-gray-300"}`}>{money(r.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
