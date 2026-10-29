import Link from "next/link";
import { Country } from "country-state-city";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatDate, formatDateTime } from "@/lib/utils/timezone";
import type { OwnOrderDetail } from "@/lib/orders/order-detail";
import { CommissionHistory } from "./commission-history";

// Read-only order detail for the sales rep and physician portals, showing
// refunds the way the admin order page does.

type AddrObj = { firstName?: string; lastName?: string; company?: string; phone?: string; address1?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string };

const statusStyle: Record<OrderStatus, string> = {
  PENDING:    "bg-amber-50   text-amber-700   border-amber-200",
  PROCESSING: "bg-blue-50    text-blue-700    border-blue-200",
  SHIPPED:    "bg-indigo-50  text-indigo-700  border-indigo-200",
  DELIVERED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED:  "bg-teal-50    text-teal-700    border-teal-200",
  CANCELLED:  "bg-red-50     text-red-700     border-red-200",
  REFUNDED:   "bg-orange-50  text-orange-700  border-orange-200",
};

const fmtMoney = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function parseAddr(raw: string | null | undefined): AddrObj | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as AddrObj; } catch { return { address1: raw }; }
}

function trackingUrl(carrier: string | null | undefined, tracking: string): string {
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (c.includes("dhl"))   return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ""} tracking ${tracking}`)}`;
}

function Address({ title, raw }: { title: string; raw: string | null | undefined }) {
  const a = parseAddr(raw);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      {a ? (
        <div className="text-sm text-gray-700 leading-relaxed">
          {(a.firstName || a.lastName) && <p className="font-semibold text-gray-800">{[a.firstName, a.lastName].filter(Boolean).join(" ")}</p>}
          {a.company && <p>{a.company}</p>}
          {a.address1 && <p>{a.address1}</p>}
          {a.address2 && <p>{a.address2}</p>}
          <p>{[a.city, a.state, a.zip].filter(Boolean).join(", ")}</p>
          {a.country && <p>{Country.getCountryByCode(a.country)?.name ?? a.country}</p>}
          {a.phone && <p className="text-gray-500 mt-1">{a.phone}</p>}
        </div>
      ) : (
        <p className="text-sm text-gray-400">—</p>
      )}
    </div>
  );
}

export function OrderDetailView({ detail, backHref, invoiceHref, viewer }: {
  detail:      OwnOrderDetail;
  backHref:    string;
  invoiceHref: string;
  viewer:      "SALES_REP" | "PHYSICIAN";
}) {
  const { order, items, refunds, refundedQty, refundedValue, commission, history } = detail;
  const returned  = order.returnedTotal ?? 0;
  const netTotal  = order.total - returned;
  const netComm   = Math.max(0, commission.amount - commission.clawback);
  const shipping  = order.shippingRate ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href={backHref} className="text-xs text-gray-500 hover:text-gray-800">← Orders</Link>
          <h1 className="text-xl font-bold text-gray-800 mt-1">Order {order.orderNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDateTime(order.createdAt)} · {order.paymentMethod === "CARD" ? "Credit / Debit Card" : "Wallet"}
            {viewer === "SALES_REP" && (
              <> · {order.physician ? `Dr. ${order.physician.firstName} ${order.physician.lastName}` : "Myself"}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2.5 py-1 border rounded-full text-xs font-semibold ${statusStyle[order.status]}`}>
            {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
          </span>
          {returned > 0 && order.status !== "REFUNDED" && (
            <span className="inline-flex px-2.5 py-1 border rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border-orange-200">
              Partially refunded
            </span>
          )}
          <Link href={invoiceHref} className="text-xs font-medium text-[#3DBFA4] hover:text-[#35a993] border border-gray-200 rounded-lg px-3 py-1.5">
            Invoice
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-5 border-b border-gray-100">
          <Address title="Billing" raw={order.billingAddress} />
          <Address title="Shipping" raw={order.shippingAddress} />
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Patient</p>
            <p className="text-sm text-gray-700 break-words">{order.customerEmail || "—"}</p>
            {order.customerPhone && <p className="text-sm text-gray-500 mt-1">{order.customerPhone}</p>}
            {order.shippingMethod && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1">Shipping method</p>
                <p className="text-sm text-gray-700">{order.shippingMethod}</p>
              </>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="px-6 py-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
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
                const refQty  = refundedQty[idx];
                const full    = refQty >= item.quantity;
                const partial = refQty > 0 && !full;
                return (
                  <tr key={idx} className={full ? "opacity-50" : ""}>
                    <td className="py-3.5 font-medium text-gray-800">
                      {item.title}
                      {full && (
                        <span className="ml-2 text-[10px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">Refunded</span>
                      )}
                      {partial && (
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
                      {partial && <p className="text-[10px] text-orange-500">−{refQty} refunded</p>}
                    </td>
                    <td className="py-3.5 text-right text-gray-700">{fmtMoney(item.unitPrice)}</td>
                    <td className="py-3.5 text-right font-semibold text-gray-900">
                      {full ? (
                        <span className="line-through text-gray-300">{fmtMoney(item.lineTotal)}</span>
                      ) : partial ? (
                        <span>
                          {fmtMoney(item.lineTotal - refundedValue[idx])}
                          <span className="block text-[10px] text-orange-400 line-through">{fmtMoney(item.lineTotal)}</span>
                        </span>
                      ) : fmtMoney(item.lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{fmtMoney(order.subtotal)}</span></div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>Coupon {order.couponCode && <span className="font-mono text-[11px]">{order.couponCode}</span>}</span>
                  <span>−{fmtMoney(order.discountAmount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span>{order.shippingMethod || "Shipping"}</span>
                <span>{shipping > 0 ? fmtMoney(shipping) : <span className="text-[#3DBFA4] font-medium">Free</span>}</span>
              </div>
              {returned > 0 && (
                <div className="flex justify-between text-sm text-orange-500 font-medium"><span>Returned</span><span>−{fmtMoney(returned)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Order Total</span><span>{fmtMoney(netTotal)}</span>
              </div>
              {returned > 0 && (
                <p className="text-right text-[11px] text-gray-400">Originally {fmtMoney(order.total)}</p>
              )}
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Order Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Commission */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-2 border-l-[#5BB8D4]">
          <p className="text-xs text-gray-400 font-medium mb-1">Your Commission</p>
          <p className="text-2xl font-bold text-[#5BB8D4]">{fmtMoney(netComm)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{commission.rate}% of {fmtMoney(order.subtotal - (order.discountAmount ?? 0))}</p>
          {commission.clawback > 0 && (
            <p className="text-xs text-orange-500 font-medium mt-1">
              {fmtMoney(commission.amount)} − {fmtMoney(commission.clawback)} for refunded items
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {order.commissionPaid ? "Paid to your wallet" : order.status === "CANCELLED" || order.status === "REFUNDED" ? "Not payable" : "Paid with the monthly payout"}
          </p>
        </div>

        {/* Tracking */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Shipment</p>
          {order.trackingNumber ? (
            <>
              {order.shippingCarrier && <p className="text-sm text-gray-600">{order.shippingCarrier}</p>}
              <a href={trackingUrl(order.shippingCarrier, order.trackingNumber)} target="_blank" rel="noreferrer"
                className="text-sm font-mono font-semibold text-indigo-600 hover:underline break-all">
                {order.trackingNumber}
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Awaiting shipment</p>
          )}
        </div>
      </div>

      {/* Refund history */}
      {refunds.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center">
            <h3 className="text-sm font-semibold text-gray-700">Refund History</h3>
            <span className="ml-auto text-[11px] text-gray-400 font-medium">{refunds.length} refund{refunds.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {refunds.map((r) => {
              const rItems = r.items as { index: number; returnedQty: number }[] | null;
              return (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-700">
                        Refund #{r.refundNumber}
                        <span className="ml-2 text-[11px] font-normal text-gray-400">{formatDate(r.processedAt)}</span>
                      </p>
                      {r.reason && <p className="text-[11px] text-gray-400 italic mt-0.5">&ldquo;{r.reason}&rdquo;</p>}
                      <ul className="mt-1.5 space-y-0.5">
                        {(rItems ?? items.map((it, i) => ({ index: i, returnedQty: it.quantity }))).map((ri) => (
                          <li key={ri.index} className="text-xs text-gray-600">
                            {ri.returnedQty} × {items[ri.index]?.title}{items[ri.index]?.variantSize ? ` (${items[ri.index].variantSize})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="text-sm font-bold text-orange-600 shrink-0">−{fmtMoney(r.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commission history (own commission only; no admin names) */}
      <CommissionHistory rows={history} showRole={false} showBy={false} />
    </div>
  );
}
