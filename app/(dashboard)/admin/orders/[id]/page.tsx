import { notFound } from "next/navigation";
import Link from "next/link";
import { Country } from "country-state-city";
import { requireAdmin } from "@/lib/auth/dal";
import { getOrderById, getOrderRefunds } from "@/actions/admin/manage-orders";
import { OrderStatus } from "@/generated/prisma/enums";
import { RefundOrderModal } from "@/components/admin/refund-order-modal";
import { PrintButton } from "@/components/sales/print-button";
import { SendOrderEmailPanel } from "@/components/admin/send-order-email-panel";
import { OrderActionsPanel } from "@/components/admin/order-actions-panel";
import { getOrderShipments } from "@/actions/admin/shipping";
import type { OrderItem, StoredRefundItem } from "@/actions/admin/manage-orders";
import { getOrderNotes } from "@/actions/admin/order-notes";
import { OrderNotesPanel } from "@/components/admin/order-notes-panel";
import { EditOrderAddress, EditOrderEmail, EditOrderPhone } from "@/components/admin/edit-order-address";
import { APP_TIMEZONE } from "@/lib/utils/timezone";

type Props = { params: Promise<{ id: string }> };

type AddrObj = { firstName?: string; lastName?: string; phone?: string; address1?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string };

function parseAddrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const a: AddrObj = JSON.parse(raw);
    return a.phone || null;
  } catch { return null; }
}

function getShippingLabel(shippingAddress: string | null | undefined, shippingRate: number): string {
  if (shippingRate <= 0) return "Free Shipping";
  if (!shippingAddress) return "Shipping";
  try {
    const a: AddrObj = JSON.parse(shippingAddress);
    if (a.country) {
      const countryName = Country.getCountryByCode(a.country)?.name ?? a.country;
      return `Shipping ${countryName} Flat Rate`;
    }
  } catch { /* fall through */ }
  const lines = shippingAddress.split("\n").map(l => l.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1];
  if (lastLine) return `Shipping ${lastLine} Flat Rate`;
  return "Shipping";
}

function fmtAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const a: AddrObj = JSON.parse(raw);
    return [
      [a.firstName, a.lastName].filter(Boolean).join(" "),
      a.address1,
      a.address2,
      [a.city, a.state, a.zip].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean).join("\n");
  } catch { return raw; }
}

// Address body without the name line (used when name is shown separately)
function fmtAddressBody(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const a: AddrObj = JSON.parse(raw);
    return [
      a.address1,
      a.address2,
      [a.city, a.state, a.zip].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean).join("\n");
  } catch { return raw; }
}


function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDate(d: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    ...(opts ?? { year: "numeric", month: "long", day: "numeric" }),
  });
}
function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function carrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string): string {
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ""} tracking ${trackingNumber}`)}`;
}

const statusStyle: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50   text-amber-700   border-amber-200",
  PROCESSING: "bg-blue-50    text-blue-700    border-blue-200",
  SHIPPED: "bg-indigo-50  text-indigo-700  border-indigo-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-teal-50    text-teal-700    border-teal-200",
  CANCELLED: "bg-red-50     text-red-700     border-red-200",
  REFUNDED: "bg-orange-50  text-orange-700  border-orange-200",
};

export default async function AdminOrderDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [order, shipments, notes, refunds] = await Promise.all([
    getOrderById(id),
    getOrderShipments(id),
    getOrderNotes(id),
    getOrderRefunds(id),
  ]);
  if (!order) notFound();

  const items = order.items as unknown as OrderItem[];

  // Build per-item refunded qty from OrderRefund records (multi-refund system)
  const refundQtyByIdx = new Map<number, number>();
  const refundLineTotalByIdx = new Map<number, number>();

  if (refunds.length > 0) {
    for (const r of refunds) {
      const rItems = r.items as StoredRefundItem[] | null;
      if (!rItems) {
        items.forEach((item, idx) => {
          refundQtyByIdx.set(idx, item.quantity);
          refundLineTotalByIdx.set(idx, item.lineTotal);
        });
      } else {
        for (const ri of rItems) {
          refundQtyByIdx.set(ri.index, (refundQtyByIdx.get(ri.index) ?? 0) + ri.returnedQty);
          refundLineTotalByIdx.set(ri.index, (refundLineTotalByIdx.get(ri.index) ?? 0) + ri.lineTotal);
        }
      }
    }
  } else if (order.returnedAt) {
    // Legacy single-refund: read from order.returnedItems
    const legacyItems = order.returnedItems;
    if (!legacyItems) {
      items.forEach((item, idx) => {
        refundQtyByIdx.set(idx, item.quantity);
        refundLineTotalByIdx.set(idx, item.lineTotal);
      });
    } else if (Array.isArray(legacyItems)) {
      for (const ri of legacyItems) {
        if (typeof ri === "number") {
          refundQtyByIdx.set(ri, items[ri]?.quantity ?? 0);
          refundLineTotalByIdx.set(ri, items[ri]?.lineTotal ?? 0);
        } else if (typeof ri === "object" && ri !== null) {
          const r = ri as { index: number; returnedQty: number; lineTotal: number };
          refundQtyByIdx.set(r.index, (refundQtyByIdx.get(r.index) ?? 0) + r.returnedQty);
          refundLineTotalByIdx.set(r.index, (refundLineTotalByIdx.get(r.index) ?? 0) + r.lineTotal);
        }
      }
    }
  }

  const alreadyRefunded = items.map((_, idx) => refundQtyByIdx.get(idx) ?? 0);
  const allItemsFullyRefunded = items.length > 0 && items.every((item, idx) => (refundQtyByIdx.get(idx) ?? 0) >= item.quantity);
  const isReturned = !!order.returnedAt;
  const customerPhone: string | null = order.customerPhone ?? null;
  const payStatus = order.paymentStatus ?? "PENDING";

  const physAddr = [
    order.physician?.addressOne,
    order.physician?.addressTwo,
    order.physician?.city,
    order.physician?.state,
    order.physician?.zipCode,
  ].filter(Boolean).join(", ");

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      <div className="max-w-6xl mx-auto">

        {/* ── Top nav ──────────────────────────────────────────────────── */}
        <div className="no-print flex items-center justify-between mb-5 gap-3 flex-wrap">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Order
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`/admin/orders/${id}/packing-list`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Packing List
            </a>
            <a
              href={`/admin/orders/${id}/invoice`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Invoice
            </a>
          </div>
        </div>

        {/* ── Refund banner ─────────────────────────────────────────────── */}
        {isReturned && (
          <div className="no-print mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-700">
                Refund processed — {fmtDate(order.returnedAt)}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-orange-600">
                {order.returnedTotal != null && (
                  <span>Refunded: <strong>{fmtMoney(order.returnedTotal)}</strong></span>
                )}
                {(order.salesRepClawback ?? 0) > 0 && (
                  <span>Rep clawback: <strong>−{fmtMoney(order.salesRepClawback!)}</strong></span>
                )}
                {(order.physicianClawback ?? 0) > 0 && (
                  <span>Doctor clawback: <strong>−{fmtMoney(order.physicianClawback!)}</strong></span>
                )}
              </div>
              {order.returnReason && (
                <p className="mt-1 text-xs text-orange-400 italic">"{order.returnReason}"</p>
              )}
            </div>
          </div>
        )}

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-5 items-start">

          {/* ════════ LEFT COLUMN ════════ */}
          <div className="space-y-4">

            {/* ── Shipping Label card ──────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Shipping Label</h3>
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#3DBFA4]/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 001 1v10l2-1m7 1V7.5M16 7.5L13 6" />
                    </svg>
                  </div>
                  <div>
                    {order.trackingNumber ? (
                      <>
                        <p className="text-sm font-semibold text-gray-800">
                          {items.length} item{items.length !== 1 ? "s" : ""} fulfilled
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {order.shippingCarrier && <span>{order.shippingCarrier} · </span>}
                          <span className="font-mono">{order.trackingNumber}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">No shipment added yet</p>
                    )}
                  </div>
                </div>

                <div className="no-print flex items-center gap-2 shrink-0">
                  {!isReturned ? (
                    <Link
                      href={`/admin/orders/${order.id}/shipment`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#3DBFA4] hover:bg-[#35a993] rounded-lg shadow-sm transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 001 1v10l2-1m7 1V7.5M16 7.5L13 6" />
                      </svg>
                      View / Add Shipment
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/orders/${order.id}/shipment?mode=return`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                      </svg>
                      Create Return Label
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* ── Order Details card ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Order {order.orderNumber} details</h2>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                      Payment via{" "}
                      <span className="font-medium text-gray-700">
                        {order.paymentMethod === "CARD" ? "Credit / Debit Card" : "Wallet Balance"}
                      </span>
                      {order.transactionId && (
                        <span className="ml-1 text-[11px] font-mono text-[#3DBFA4]"> · {order.transactionId}</span>
                      )}
                      {payStatus === "PAID" && (
                        <span className="ml-1"> · Paid on {fmtDateTime(order.updatedAt)}</span>
                      )}
                    </p>
                  </div>
                  {/* <span className={`inline-flex px-2.5 py-1 border rounded-full text-xs font-semibold ${statusStyle[order.status]}`}>
                    {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                  </span> */}
                </div>
              </div>

              {/* General / Billing / Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 border-b border-gray-100">

                {/* General */}
                <div className="px-6 py-5">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">General</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] text-gray-400 mb-0.5">Date created:</p>
                      <p className="text-sm text-gray-700">{fmtDate(order.createdAt, { year: "numeric", month: "short", day: "numeric" })}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1">Status:</p>
                      <span className={`inline-flex px-2 py-0.5 border rounded-full text-xs font-semibold ${statusStyle[order.status]}`}>
                        {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {order.salesRep && (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-0.5">Medical Rep:</p>
                        <p className="text-sm font-medium text-gray-700">{order.salesRep.name}</p>
                        <p className="text-xs text-gray-400">{order.salesRep.email}</p>
                      </div>
                    )}
                    {!order.salesRep && order.physician && (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-0.5">Ordered by:</p>
                        <p className="text-sm text-gray-700"> (Direct)</p>
                      </div>
                    )}
                    {/* {order.customerEmail && (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-0.5">
                          Patient Email:
                          <EditOrderEmail orderId={order.id} current={order.customerEmail} />
                        </p>
                        <a href={`mailto:${order.customerEmail}`} className="text-xs text-[#3DBFA4] hover:underline break-all">
                          {order.customerEmail}
                        </a>
                      </div>
                    )} */}
                    {/* {(customerPhone || order.customerEmail) && (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-0.5">
                          Patient Phone:
                          <EditOrderPhone orderId={order.id} current={customerPhone} />
                        </p>
                        {customerPhone && (
                          <a href={`tel:${customerPhone}`} className="text-xs text-[#3DBFA4] hover:underline">
                            {customerPhone}
                          </a>
                        )}
                      </div>
                    )} */}
                  </div>
                </div>

                {/* Billing */}
                <div className="px-6 py-5">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Billing</h4>
                  {order.billingAddress ? (
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-gray-800">
                        {fmtAddress(order.billingAddress)?.split("\n")[0]}
                      </p>
                      <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-line">
                        {fmtAddressBody(order.billingAddress)}
                      </p>
                      {(parseAddrPhone(order.billingAddress) || customerPhone) && (
                        <div>
                          <p className="text-[11px] text-gray-400 mb-0.5">Phone:</p>
                          {parseAddrPhone(order.billingAddress) && (
                            <a href={`tel:${parseAddrPhone(order.billingAddress)}`} className="block text-xs text-[#3DBFA4] hover:underline">
                              {parseAddrPhone(order.billingAddress)}
                            </a>
                          )}
                          {customerPhone && customerPhone !== parseAddrPhone(order.billingAddress) && (
                            <a href={`tel:${customerPhone}`} className="block text-xs text-[#3DBFA4] hover:underline">
                              {customerPhone}
                            </a>
                          )}
                        </div>
                      )}
                      <EditOrderAddress orderId={order.id} type="billing" raw={order.billingAddress} />
                    </div>
                  ) : order.physician ? (
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-gray-800">
                        {order.physician.firstName} {order.physician.lastName}
                      </p>
                      {order.physician.nameOfPractice && (
                        <p className="text-gray-600">{order.physician.nameOfPractice}</p>
                      )}
                      {physAddr && (
                        <p className="text-gray-500 text-xs leading-relaxed">{physAddr}</p>
                      )}
                      <p className="text-[#3DBFA4] text-xs">{order.physician.email}</p>
                      {order.physician.phone && (
                        <a href={`tel:${order.physician.phone}`} className="block text-xs text-[#3DBFA4] hover:underline">
                          {order.physician.phone}
                        </a>
                      )}
                      <EditOrderAddress orderId={order.id} type="billing" raw={null} />
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-400">No billing info</p>
                      <EditOrderAddress orderId={order.id} type="billing" raw={null} />
                    </div>
                  )}
                </div>

                {/* Shipping */}
                <div className="px-6 py-5">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Shipping</h4>
                  {order.shippingAddress ? (
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-gray-800">
                        {fmtAddress(order.shippingAddress)?.split("\n")[0]}
                      </p>
                      <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-line">
                        {fmtAddressBody(order.shippingAddress)}
                      </p>
                      {order.customerEmail && (
                        <div>
                          <p className="text-[11px] text-gray-400 mb-0.5">
                            Patient Email:
                            <EditOrderEmail orderId={order.id} current={order.customerEmail} />
                          </p>
                          <a href={`mailto:${order.customerEmail}`} className="text-xs text-[#3DBFA4] hover:underline break-all">
                            {order.customerEmail}
                          </a>
                        </div>
                      )}
                      {(parseAddrPhone(order.shippingAddress) || customerPhone) && (
                        <div>
                          <p className="text-[11px] text-gray-400 mb-0.5">Phone:</p>
                          {parseAddrPhone(order.shippingAddress) && (
                            <a href={`tel:${parseAddrPhone(order.shippingAddress)}`} className="block text-xs text-[#3DBFA4] hover:underline">
                              {parseAddrPhone(order.shippingAddress)}
                            </a>
                          )}
                          {customerPhone && customerPhone !== parseAddrPhone(order.shippingAddress) && (
                            <a href={`tel:${customerPhone}`} className="block text-xs text-[#3DBFA4] hover:underline">
                              {customerPhone}
                            </a>
                          )}
                        </div>
                      )}
                      <EditOrderAddress orderId={order.id} type="shipping" raw={order.shippingAddress} />
                    </div>
                  ) : order.physician ? (
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-gray-800">
                        {order.physician.firstName} {order.physician.lastName}
                      </p>
                      {physAddr && (
                        <p className="text-gray-500 text-xs leading-relaxed">{physAddr}</p>
                      )}
                      {order.physician.phone && (
                        <a href={`tel:${order.physician.phone}`} className="block text-xs text-[#3DBFA4] hover:underline">
                          {order.physician.phone}
                        </a>
                      )}
                      <EditOrderAddress orderId={order.id} type="shipping" raw={null} />
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-400">No shipping info</p>
                      <EditOrderAddress orderId={order.id} type="shipping" raw={null} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Items table ──────────────────────────────────────── */}
              <div className="px-6 py-5 border-b border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="text-left pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size / SKU</th>
                      <th className="text-center pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="text-right pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="text-right pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, idx) => {
                      const refQty = refundQtyByIdx.get(idx) ?? 0;
                      const refLineTotal = refundLineTotalByIdx.get(idx) ?? 0;
                      const isFullyRefunded = refQty >= item.quantity;
                      const isPartialRefunded = refQty > 0 && refQty < item.quantity;
                      return (
                        <tr key={idx} className={isFullyRefunded ? "opacity-50" : ""}>
                          <td className="py-3.5 font-medium text-gray-800">
                            {item.title}
                            {isFullyRefunded && (
                              <span className="ml-2 text-[10px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                                Refunded
                              </span>
                            )}
                            {isPartialRefunded && (
                              <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                Partial Refund ({refQty}/{item.quantity})
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-gray-500">
                            {item.variantSize || "—"}
                            {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                          </td>
                          <td className="py-3.5 text-center text-gray-700">
                            {item.quantity}
                            {isPartialRefunded && (
                              <p className="text-[10px] text-orange-500">−{refQty} refunded</p>
                            )}
                          </td>
                          <td className="py-3.5 text-right text-gray-700">{fmtMoney(item.unitPrice)}</td>
                          <td className="py-3.5 text-right font-semibold text-gray-900">
                            {isFullyRefunded
                              ? <span className="line-through text-gray-300">{fmtMoney(item.lineTotal)}</span>
                              : isPartialRefunded
                                ? (
                                  <span>
                                    {fmtMoney(item.lineTotal - refLineTotal)}
                                    <span className="block text-[10px] text-orange-400 line-through">{fmtMoney(item.lineTotal)}</span>
                                  </span>
                                )
                                : fmtMoney(item.lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                  <div className="flex justify-end gap-8">
                    <div className="w-48 space-y-1.5">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span><span>{fmtMoney(order.subtotal)}</span>
                      </div>
                      {(order.discountAmount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600 font-medium">
                          <span className="flex items-center gap-1">
                            Coupon
                            {order.couponCode && (
                              <span className="font-mono text-[11px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-emerald-700">
                                {order.couponCode}
                              </span>
                            )}
                          </span>
                          <span>−{fmtMoney(order.discountAmount ?? 0)}</span>
                        </div>
                      )}
                      {(() => {
                        const stored = order.shippingRate ?? 0;
                        const implied = parseFloat((order.total - order.subtotal + (order.discountAmount ?? 0)).toFixed(2));
                        const display = stored > 0 ? stored : implied > 0 ? implied : 0;
                        return (
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>{order.shippingMethod || getShippingLabel(order.shippingAddress, display)}</span>
                            <span>
                              {display === 0
                                ? <span className="text-[#3DBFA4] font-medium">Free</span>
                                : fmtMoney(display)}
                            </span>
                          </div>
                        );
                      })()}
                      {isReturned && order.returnedTotal != null && (
                        <div className="flex justify-between text-sm text-orange-500 font-medium">
                          <span>Returned</span><span>−{fmtMoney(order.returnedTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                        <span>Order Total</span>
                        <span>
                          {isReturned && order.returnedTotal != null
                            ? fmtMoney(order.total - order.returnedTotal)
                            : fmtMoney(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Order Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>

            {/* ── Commission summary ───────────────────────────────────── */}
            <div className="no-print grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-400 font-medium mb-1">Order Total</p>
                <p className="text-xl font-bold text-gray-800">{fmtMoney(order.total)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 border-l-2 border-l-[#5BB8D4]">
                <p className="text-xs text-gray-400 font-medium mb-1">Rep Commission</p>
                {order.salesRep && (
                  <p className="text-xs font-semibold text-gray-600 mb-1">{order.salesRep.name}</p>
                )}
                <p className="text-xl font-bold text-[#5BB8D4]">{fmtMoney(order.salesRepCommissionAmount)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{order.salesRepCommissionRate}%</p>
                {(order.salesRepClawback ?? 0) > 0 && (
                  <p className="text-xs text-orange-500 font-medium mt-0.5">−{fmtMoney(order.salesRepClawback!)} clawed back</p>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 border-l-2 border-l-[#8b5cf6]">
                <p className="text-xs text-gray-400 font-medium mb-1">Doctor Commission</p>
                {order.physician && (
                  <p className="text-xs font-semibold text-gray-600 mb-1">Dr. {order.physician.firstName} {order.physician.lastName}</p>
                )}
                <p className="text-xl font-bold text-[#8b5cf6]">{fmtMoney(order.physicianCommissionAmount)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{order.physicianCommissionRate}%</p>
                {(order.physicianClawback ?? 0) > 0 && (
                  <p className="text-xs text-orange-500 font-medium mt-0.5">−{fmtMoney(order.physicianClawback!)} clawed back</p>
                )}
              </div>
            </div>

            {/* ── Refund Activity Log ──────────────────────────────────── */}
            {refunds.length > 0 && (
              <div className="no-print bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-700">Refund History</h3>
                  <span className="ml-auto text-[11px] text-gray-400 font-medium">
                    {refunds.length} event{refunds.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {refunds.map((refund) => {
                    const rItems = refund.items as StoredRefundItem[] | null;
                    return (
                      <div key={refund.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-xs font-bold text-gray-700">
                              Refund #{refund.refundNumber}
                              <span className="ml-2 text-[11px] font-normal text-gray-400">
                                {fmtDateTime(refund.processedAt as Date)}
                              </span>
                            </p>
                            {refund.reason && (
                              <p className="text-[11px] text-gray-400 italic mt-0.5">"{refund.reason as string}"</p>
                            )}
                          </div>
                          <span className="text-sm font-bold text-orange-600 shrink-0">
                            −{fmtMoney(refund.total as number)}
                          </span>
                        </div>

                        <div className="space-y-0.5 mb-2">
                          {!rItems ? (
                            <p className="text-xs text-gray-500">All items — full refund</p>
                          ) : (
                            rItems.map((ri) => {
                              const item = items[ri.index];
                              return item ? (
                                <p key={ri.index} className="text-xs text-gray-500">
                                  {item.title}
                                  {item.variantSize && <span className="text-gray-400"> · {item.variantSize}</span>}
                                  <span className="text-gray-700 font-medium"> × {ri.returnedQty}</span>
                                  <span className="text-gray-400 ml-1">({fmtMoney(ri.lineTotal)})</span>
                                </p>
                              ) : null;
                            })
                          )}
                        </div>

                        {((refund.salesRepClawback as number) > 0 || (refund.physicianClawback as number) > 0) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-orange-500 font-medium">
                            {(refund.salesRepClawback as number) > 0 && (
                              <span>Rep clawback: −{fmtMoney(refund.salesRepClawback as number)}</span>
                            )}
                            {(refund.physicianClawback as number) > 0 && (
                              <span>Dr clawback: −{fmtMoney(refund.physicianClawback as number)}</span>
                            )}
                          </div>
                        )}

                        {refund.customerRefundMethod && (refund.customerRefundAmount as number) > 0 && (
                          <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg w-fit ${refund.customerRefundMethod === "stripe"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-emerald-50 text-emerald-700"
                            }`}>
                            {refund.customerRefundMethod === "stripe" ? (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            Customer refund {fmtMoney(refund.customerRefundAmount as number)} via{" "}
                            {refund.customerRefundMethod === "stripe" ? "Stripe (original card)" : "manual"}
                            {refund.stripeRefundId && (
                              <span className="font-mono text-[10px] opacity-60 ml-1">· {refund.stripeRefundId as string}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ════════ RIGHT SIDEBAR ════════ */}
          <div className="no-print space-y-4 lg:sticky lg:top-6">

            {/* Send Order Email */}
            <SendOrderEmailPanel orderId={id} />

            {/* Shipment Tracking */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Shipment Tracking</h3>
              </div>
              <div className="p-4">
                {order.shippingMethod && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-xs font-medium ${
                    order.shippingMethod.includes("FedEx 2Day")
                      ? "bg-orange-50 text-orange-700 border border-orange-200"
                      : "bg-gray-50 text-gray-600 border border-gray-200"
                  }`}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Customer selected: {order.shippingMethod}
                  </div>
                )}
                {order.trackingNumber ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {fmtDate(order.updatedAt, { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#3DBFA4]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 001 1v10l2-1m7 1V7.5M16 7.5L13 6" />
                        </svg>
                      </div>
                      <div>
                        <a
                          href={carrierTrackingUrl(order.shippingCarrier, order.trackingNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono font-semibold text-[#3DBFA4] hover:underline inline-flex items-center gap-1"
                        >
                          {order.trackingNumber}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        {order.shippingCarrier && (
                          <p className="text-xs text-gray-400 mt-0.5">({order.shippingCarrier})</p>
                        )}
                        {order.estimatedDelivery && (
                          <p className="text-xs text-gray-400 mt-1">
                            Est. delivery: {fmtDate(order.estimatedDelivery, { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">No tracking info yet</p>
                )}
              </div>
            </div>

            {/* Order Actions */}
            <OrderActionsPanel
              orderId={id}
              current={order.status}
              isReturned={isReturned}
            />

            {/* Refund action — hidden only when all items are fully refunded */}
            {!allItemsFullyRefunded && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Refund Order</p>
                <RefundOrderModal
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  total={order.total}
                  shippingRate={order.shippingRate ?? 0}
                  items={items}
                  alreadyRefunded={alreadyRefunded}
                  existingSalesRepClawback={order.salesRepClawback ?? 0}
                  existingPhysicianClawback={order.physicianClawback ?? 0}
                  salesRepName={order.salesRep?.name ?? null}
                  physicianName={order.physician ? `${order.physician.firstName} ${order.physician.lastName}` : null}
                  salesRepCommissionAmount={order.salesRepCommissionAmount}
                  physicianCommissionAmount={order.physicianCommissionAmount}
                  commissionPaid={order.commissionPaid}
                  salesRepWalletBalance={order.salesRep?.walletBalance ?? null}
                  physicianWalletBalance={order.physician?.walletBalance ?? null}
                  stripePaymentIntentId={order.stripePaymentIntentId ?? null}
                  paymentMethod={order.paymentMethod ?? null}
                />
              </div>
            )}

            {/* Order Notes */}
            <OrderNotesPanel orderId={id} initialNotes={notes} />
          </div>
        </div>
      </div>
    </>
  );
}
