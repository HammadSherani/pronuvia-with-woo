import { requireAdmin } from "@/lib/auth/dal";
import { getShippingZones } from "@/lib/woo/shipping";
import { wpAdmin } from "@/lib/woo/admin-links";

export const metadata = { title: "Shipping Rates – Pronuvia" };

// Shipping rates are WooCommerce shipping zones: shown here, added and
// changed in WP admin (the buttons open it, signed in).
function money(v: string | null) {
  if (!v) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : v;
}

export default async function ShippingRatesPage() {
  await requireAdmin();
  let zones: Awaited<ReturnType<typeof getShippingZones>> = [];
  let failed = false;
  try { zones = await getShippingZones(); } catch (e) { console.error("[shipping-rates]", e); failed = true; }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipping Rates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {zones.length} shipping zone{zones.length !== 1 ? "s" : ""} · added and changed in WooCommerce
          </p>
        </div>
        <a href={wpAdmin.shipping()} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-xl shadow-sm transition-colors">
          Manage in WooCommerce ↗
        </a>
      </div>

      {failed && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          Shipping zones could not be loaded from WooCommerce. Try again in a moment.
        </div>
      )}

      {zones.map((z) => (
        <div key={z.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-800">{z.name}</h2>
              <p className="text-xs text-gray-400 mt-1">
                {z.regions.length === 0
                  ? (z.id === 0 ? "Addresses that match no other zone" : "No regions")
                  : `${z.regions.slice(0, 6).join(", ")}${z.regions.length > 6 ? ` +${z.regions.length - 6} more` : ""}`}
              </p>
            </div>
            <a href={wpAdmin.shippingZone(z.id)} target="_blank" rel="noreferrer"
              className="text-xs font-semibold text-[#3DBFA4] hover:underline whitespace-nowrap">
              Edit in WooCommerce ↗
            </a>
          </div>
          {z.methods.length === 0 ? (
            <p className="px-6 py-5 text-xs text-gray-400">No shipping methods: orders to these addresses can&apos;t be shipped.</p>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[38%]" /><col className="w-[20%]" /><col className="w-[24%]" /><col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {["Method", "Type", "Cost", "Status"].map((h) => (
                    <th key={h} className="text-left px-6 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {z.methods.map((m) => (
                  <tr key={m.id}>
                    <td className="px-6 py-3 font-medium text-gray-800">{m.title}</td>
                    <td className="px-6 py-3 text-xs text-gray-500">{m.type}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-800">
                      {m.type === "Free shipping"
                        ? (m.minAmount ? `Free over ${money(m.minAmount)}` : "Free")
                        : money(m.cost)}
                      {m.taxable && m.type !== "Free shipping" && <span className="ml-1 text-[10px] font-normal text-gray-400">+ tax</span>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${m.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {m.enabled ? "Active" : "Off"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
