import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { getOrderById } from "@/actions/admin/manage-orders";
import { getOrderShipments } from "@/actions/admin/shipping";
import { carrierName } from "@/lib/orders/woo-labels";
import { isFedEx2Day } from "@/lib/orders/shipping-method";
import { wpAdmin } from "@/lib/woo/admin-links";
import { formatDateTime } from "@/lib/utils/timezone";

// Labels are bought in WP admin with the WooCommerce Shipping plugin, on the
// order's page there. Opening this page (like the Woo webhook) picks up the
// labels bought: the order turns Shipped and the patient gets the tracking.

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> };

function trackingUrl(carrier: string, tracking: string): string {
  const c = carrier.toLowerCase();
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (c.includes("dhl"))   return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} tracking ${tracking}`)}`;
}

export default async function OrderShipmentPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { mode } = await searchParams;
  const isReturn = mode === "return";

  // getOrderById brings the order up to date with Woo first, labels included
  const order = await getOrderById(id);
  if (!order) notFound();
  const [labels, oldShipments] = await Promise.all([
    prisma.wooLabel.findMany({ where: { orderId: id }, orderBy: { purchasedAt: "desc" } }),
    getOrderShipments(id),
  ]);

  const expedited = isFedEx2Day(order.shippingMethod);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/admin/orders/${order.id}`} className="text-xs text-gray-500 hover:text-gray-800">← Order {order.orderNumber}</Link>
          <h1 className="text-xl font-bold text-gray-800 mt-1">{isReturn ? "Return label" : "Shipping labels"}</h1>
        </div>
        <Link href={`/admin/orders/${order.id}/shipment${isReturn ? "?mode=return" : ""}`}
          className="text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
          Refresh from WooCommerce
        </Link>
      </div>

      {order.shippingMethod && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${expedited ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
          Customer selected: <span className="font-semibold">{order.shippingMethod}</span>
          {expedited && <span className="block text-xs mt-0.5">Buy a FedEx 2Day label for this order.</span>}
        </div>
      )}

      {/* Where labels are made */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {order.wooOrderId ? (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="text-sm text-gray-600 max-w-xl">
              <p className="font-semibold text-gray-800 mb-1">
                {isReturn ? "Create the return label in WooCommerce" : "Create the label in WooCommerce"}
              </p>
              <p>
                Open the order in WP admin and use the <span className="font-medium">WooCommerce Shipping</span> panel
                {isReturn ? " to create a return label." : " to buy the label (package, carrier, service, print)."}
                {" "}It shows up here by itself{isReturn ? "." : "; the order turns Shipped and the patient gets the tracking email."}
              </p>
            </div>
            <a href={wpAdmin.editOrder(order.wooOrderId)} target="_blank" rel="noreferrer"
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg shadow-sm ${isReturn ? "bg-orange-500 hover:bg-orange-600" : "bg-[#3DBFA4] hover:bg-[#35a993]"}`}>
              Open order #{order.wooOrderId} in WooCommerce ↗
            </a>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            This order is not in WooCommerce yet, so a label can&apos;t be made for it.
            {order.wooSyncStatus ? " It is retried automatically." : " It was placed before orders moved to WooCommerce."}
          </p>
        )}
      </div>

      {/* Labels from WooCommerce */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Labels ({labels.length})</h2>
        </div>
        {labels.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">No labels yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {labels.map((l) => (
              <div key={l.id} className={`px-5 py-3 flex items-center justify-between gap-4 flex-wrap ${l.refunded ? "opacity-60" : ""}`}>
                <div className="text-sm">
                  <p className="font-medium text-gray-800">
                    {carrierName(l.carrier)} · {l.service}
                    {l.isReturn && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Return</span>}
                    {l.refunded && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Refunded</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {l.packageName && <span>{l.packageName} · </span>}
                    {formatDateTime(l.purchasedAt)}
                    {l.notifiedAt && <span> · tracking emailed</span>}
                  </p>
                </div>
                <a href={trackingUrl(l.carrier, l.tracking)} target="_blank" rel="noreferrer"
                  className="font-mono text-xs text-[#3DBFA4] hover:underline">{l.tracking}</a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Labels bought with the old FedEx / UPS / USPS integration */}
      {oldShipments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Earlier labels ({oldShipments.length})</h2>
            <p className="text-xs text-gray-400">Bought before shipping moved to WooCommerce. View only.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {oldShipments.map((s) => (
              <div key={s.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="font-medium text-gray-800">
                    {s.carrierLabel} · {s.service}
                    {s.isReturn && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Return</span>}
                  </p>
                  <a href={trackingUrl(s.carrier, s.trackingNumber)} target="_blank" rel="noreferrer"
                    className="font-mono text-xs text-[#3DBFA4] hover:underline">{s.trackingNumber}</a>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(s.createdAt)} · ${s.cost.toFixed(2)}</p>
                {s.labelBase64 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Show label</summary>
                    {s.labelFormat === "PDF" ? (
                      <object data={`data:application/pdf;base64,${s.labelBase64}`} type="application/pdf"
                        className="mt-2 w-full h-96 border border-gray-200 rounded" aria-label={`Label ${s.trackingNumber}`} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={`Label ${s.trackingNumber}`} className="mt-2 max-w-xs border border-gray-200 rounded"
                        src={`data:image/png;base64,${s.labelBase64}`} />
                    )}
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
