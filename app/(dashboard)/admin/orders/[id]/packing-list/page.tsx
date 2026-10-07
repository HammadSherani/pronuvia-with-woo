import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getOrderById } from "@/actions/admin/manage-orders";
import { PrintButton } from "@/components/sales/print-button";
import { formatDateLong } from "@/lib/utils/timezone";
import type { OrderItem } from "@/actions/admin/manage-orders";

type Props = { params: Promise<{ id: string }> };

type AddrObj = {
  firstName?: string; lastName?: string; phone?: string;
  address1?: string; address2?: string; city?: string;
  state?: string; zip?: string; country?: string;
};

function fmtAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const a: AddrObj = JSON.parse(raw);
    return [
      [a.firstName, a.lastName].filter(Boolean).join(" "),
      a.address1, a.address2,
      [a.city, a.state, a.zip].filter(Boolean).join(", "),
      a.country,
      a.phone,
    ].filter(Boolean).join("\n");
  } catch { return raw; }
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return formatDateLong(d);
}

export default async function AdminPackingListPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const items = order.items as unknown as OrderItem[];

  return (
    <>
      <style>{`
        @page { margin: 10mm 15mm; size: A4 portrait; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          #pack-root { max-width: 100% !important; margin: 0 !important; }
          #pack-card { box-shadow: none !important; }
          #pack-header { padding: 12px 24px !important; }
          #pack-body { padding: 12px 24px !important; }
          #pack-body > .space-y-6 > * + * { margin-top: 12px !important; }
          #pack-body td, #pack-body th { padding: 6px 10px !important; font-size: 11px !important; }
        }
      `}</style>

      <div id="pack-root" className="max-w-2xl mx-auto">

        {/* Toolbar */}
        <div className="no-print flex items-center justify-between mb-6">
          <Link
            href={`/admin/orders/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Order
          </Link>
          <PrintButton label="Print Packing List" />
        </div>

        {/* Packing list card */}
        <div id="pack-card" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Header */}
          <div id="pack-header" className="bg-gray-900 px-8 py-6 text-white flex items-start justify-between">
            <div>
              <p className="text-2xl font-black tracking-tight">PRONUVIA</p>
              <p className="text-xs text-white/50 mt-0.5 uppercase tracking-wider font-semibold">Packing List</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Order</p>
              <p className="text-xl font-bold font-mono">#{order.orderNumber}</p>
              <p className="text-xs text-white/50 mt-1">{fmtDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Body */}
          <div id="pack-body" className="px-8 py-6 space-y-6">

            {/* Shipping method — always shown so warehouse staff know how this ships */}
            {order.shippingMethod && (
              <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 ${
                order.shippingMethod.includes("FedEx 2Day")
                  ? "bg-orange-50 border-orange-300"
                  : "bg-gray-50 border-gray-200"
              }`}>
                <svg className={`w-4 h-4 shrink-0 ${order.shippingMethod.includes("FedEx 2Day") ? "text-orange-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className={`text-sm font-bold ${order.shippingMethod.includes("FedEx 2Day") ? "text-orange-700" : "text-gray-700"}`}>
                  {order.shippingMethod}
                </p>
              </div>
            )}

            {/* From / Ship To */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">From</p>
                <p className="text-sm font-semibold text-gray-700">Pronuvia</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ship To</p>
                {order.shippingAddress ? (
                  <p className="text-sm font-semibold text-gray-800 whitespace-pre-line leading-relaxed">
                    {fmtAddress(order.shippingAddress)}
                  </p>
                ) : order.physician ? (
                  <div className="text-sm text-gray-800 space-y-0.5">
                    <p className="font-semibold">
                      {order.physician.firstName} {order.physician.lastName}
                    </p>
                    {[
                      order.physician.addressOne,
                      order.physician.addressTwo,
                      [order.physician.city, order.physician.state, order.physician.zipCode].filter(Boolean).join(", "),
                    ].filter(Boolean).map((line, i) => (
                      <p key={i} className="text-gray-600 text-xs">{line}</p>
                    ))}
                    {order.physician.phone && (
                      <p className="text-gray-500 text-xs">{order.physician.phone}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No shipping address</p>
                )}
                {order.customerEmail && (
                  <p className="text-xs text-gray-400 mt-1">{order.customerEmail}</p>
                )}
                {order.customerPhone && (
                  <p className="text-xs text-gray-400">{order.customerPhone}</p>
                )}
              </div>
            </div>

            {/* Tracking */}
            {order.trackingNumber && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tracking Number</p>
                  <p className="text-sm font-mono font-bold text-gray-800 mt-0.5">{order.trackingNumber}</p>
                </div>
                {order.shippingCarrier && (
                  <p className="text-xs text-gray-500 font-medium">{order.shippingCarrier}</p>
                )}
              </div>
            )}

            {/* Items table */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Items to Pack</p>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size / SKU</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">✓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-medium text-gray-800">{item.title}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {item.variantSize || "—"}
                          {item.sku && (
                            <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900 text-base">{item.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block w-5 h-5 border-2 border-gray-400 rounded" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Special Notes</p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-100 pt-4 text-center">
              <p className="text-xs text-gray-400">Please verify all items before sealing the package.</p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
