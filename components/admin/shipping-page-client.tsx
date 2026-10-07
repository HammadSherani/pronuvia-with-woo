"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter }  from "next/navigation";
import Link           from "next/link";
import toast          from "react-hot-toast";
import { getShippingRates, purchaseLabel } from "@/actions/admin/shipping";
import type { ShipmentDirection } from "@/actions/admin/shipping";
import type { CarrierCode, PackageInfo, RateResult, LabelSize } from "@/lib/shipping/types";
import type { OrderItem } from "@/actions/admin/manage-orders";
import { formatDateLong, toDateInputValue } from "@/lib/utils/timezone";

// ── Types ─────────────────────────────────────────────────────────────────────

type WeightUnit = "lbs" | "kg" | "oz" | "g";
type PkgType    = "Box" | "Envelope" | "Tube" | "Pak" | "Other";

type Shipment = {
  id: string; carrier: string; carrierLabel: string; service: string;
  trackingNumber: string; labelBase64: string | null; labelFormat: string;
  labelSize?: string; isReturn?: boolean;
  cost: number; shipDate: Date;
};

type SavedTemplate = {
  id: string; name: string; type: PkgType;
  lengthCm: number; widthCm: number; heightCm: number;
};

interface Props {
  orderId:        string;
  orderNumber:    string;
  shipments:      Shipment[];
  items:          OrderItem[];
  shipTo:         { name: string | null; address: string | null };
  shipFrom:       { name: string; street: string; city: string; state: string; zip: string; country: string };
  orderValue:     number;
  subtotal:       number;
  shippingRate:   number;
  shippingCarrier: string | null;
  // The option the customer selected at checkout, e.g. "FedEx 2Day Shipping"
  // — distinct from shippingCarrier, which is only set once a label is
  // actually bought. Used to steer the admin toward the matching rate.
  shippingMethod?: string | null;
  testModeCarriers?: { ups: boolean; fedex: boolean; usps: boolean };
  // "return" pre-configures the form for a return label: warehouse/customer
  // addresses swap, FedEx is excluded, and a successful purchase does not
  // mark the order SHIPPED or touch inventory.
  mode?: ShipmentDirection;
}

function isExpeditedMethod(method: string | null | undefined): boolean {
  return !!method && method.includes("FedEx 2Day");
}

// Matches the live rate that corresponds to the customer's checkout choice —
// FedEx's "2Day" service in whatever casing/spacing the carrier API returns.
function findMatchingRate(rates: RateResult[]): RateResult | undefined {
  return rates.find((r) => r.carrier === "fedex" && /2\s*day/i.test(r.service));
}

// ── Static carrier package data ───────────────────────────────────────────────

type CarrierPkg = { id: string; carrier: CarrierCode; name: string; lCm: number; wCm: number; hCm: number };

function inToCm(i: number) { return parseFloat((i * 2.54).toFixed(2)); }

const CARRIER_PACKAGES: { group: string; carrier: CarrierCode; packages: CarrierPkg[] }[] = [
  {
    group: "FedEx Express Packages", carrier: "fedex",
    packages: [
      { id: "FEDEX_ENVELOPE",        carrier: "fedex", name: "Envelope",           lCm: inToCm(12.5),  wCm: inToCm(9.5),   hCm: inToCm(0.5)  },
      { id: "FEDEX_PAK",             carrier: "fedex", name: "Pak",                lCm: inToCm(15.5),  wCm: inToCm(12),    hCm: inToCm(0.5)  },
      { id: "FEDEX_SMALL_BOX_S1",    carrier: "fedex", name: "Small Box (S1)",     lCm: inToCm(12.25), wCm: inToCm(10.88), hCm: inToCm(1.5)  },
      { id: "FEDEX_SMALL_BOX_S2",    carrier: "fedex", name: "Small Box (S2)",     lCm: inToCm(11.25), wCm: inToCm(8.75),  hCm: inToCm(4.38) },
      { id: "FEDEX_MEDIUM_BOX_M1",   carrier: "fedex", name: "Medium Box (M1)",    lCm: inToCm(13.25), wCm: inToCm(11.5),  hCm: inToCm(2.38) },
      { id: "FEDEX_MEDIUM_BOX_M2",   carrier: "fedex", name: "Medium Box (M2)",    lCm: inToCm(11.25), wCm: inToCm(8.75),  hCm: inToCm(6)    },
      { id: "FEDEX_LARGE_BOX_L1",    carrier: "fedex", name: "Large Box (L1)",     lCm: inToCm(17.88), wCm: inToCm(12.38), hCm: inToCm(3)    },
      { id: "FEDEX_LARGE_BOX_L2",    carrier: "fedex", name: "Large Box (L2)",     lCm: inToCm(11.25), wCm: inToCm(8.75),  hCm: inToCm(7.75) },
      { id: "FEDEX_EXTRA_LARGE_X1",  carrier: "fedex", name: "Extra Large Box (X1)",lCm: inToCm(11.88),wCm: inToCm(10.75), hCm: inToCm(11)   },
      { id: "FEDEX_EXTRA_LARGE_X2",  carrier: "fedex", name: "Extra Large Box (X2)",lCm: inToCm(15.75),wCm: inToCm(14.13), hCm: inToCm(6)    },
      { id: "FEDEX_TUBE",            carrier: "fedex", name: "Tube",               lCm: inToCm(38),    wCm: inToCm(6),     hCm: inToCm(6)    },
    ],
  },
  {
    group: "FedEx International Boxes", carrier: "fedex",
    packages: [
      { id: "FEDEX_INTL_S", carrier: "fedex", name: "International Box S", lCm: inToCm(11.88), wCm: inToCm(9.25), hCm: inToCm(1.75) },
      { id: "FEDEX_INTL_M", carrier: "fedex", name: "International Box M", lCm: inToCm(13),    wCm: inToCm(9.25), hCm: inToCm(3.25) },
      { id: "FEDEX_INTL_L", carrier: "fedex", name: "International Box L", lCm: inToCm(15),    wCm: inToCm(12),   hCm: inToCm(3.25) },
    ],
  },
  {
    group: "UPS Express Packages", carrier: "ups",
    packages: [
      { id: "UPS_BOX_SM",  carrier: "ups", name: "Express Box Small",  lCm: inToCm(13),   wCm: inToCm(11), hCm: inToCm(2)   },
      { id: "UPS_BOX_MD",  carrier: "ups", name: "Express Box Medium", lCm: inToCm(15),   wCm: inToCm(11), hCm: inToCm(3)   },
      { id: "UPS_BOX_LG",  carrier: "ups", name: "Express Box Large",  lCm: inToCm(17),   wCm: inToCm(12), hCm: inToCm(3.5) },
      { id: "UPS_PAK",     carrier: "ups", name: "Express Pak",        lCm: inToCm(15.5), wCm: inToCm(12), hCm: inToCm(0.5) },
    ],
  },
  {
    group: "USPS Priority Mail", carrier: "usps",
    packages: [
      { id: "USPS_PM_SM",   carrier: "usps", name: "Small Box",          lCm: inToCm(8.63),  wCm: inToCm(5.38),  hCm: inToCm(1.63) },
      { id: "USPS_PM_MD1",  carrier: "usps", name: "Medium Box 1",       lCm: inToCm(11),    wCm: inToCm(8.5),   hCm: inToCm(5.5)  },
      { id: "USPS_PM_MD2",  carrier: "usps", name: "Medium Box 2",       lCm: inToCm(13.63), wCm: inToCm(11.88), hCm: inToCm(3.38) },
      { id: "USPS_PM_LG",   carrier: "usps", name: "Large Box",          lCm: inToCm(12),    wCm: inToCm(12),    hCm: inToCm(5.5)  },
      { id: "USPS_PM_ENV",  carrier: "usps", name: "Flat Rate Envelope", lCm: inToCm(12.5),  wCm: inToCm(9.5),   hCm: inToCm(0.5)  },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("en-US", { style: "currency", currency: "USD" }); }

function parseAddressLines(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw);
    const lines: string[] = [];
    if (obj.address1) lines.push(obj.address1);
    if (obj.address2) lines.push(obj.address2);
    const city = [obj.city, obj.state && obj.zip ? `${obj.state} ${obj.zip}` : (obj.state || obj.zip)].filter(Boolean).join(", ");
    if (city) lines.push(city);
    if (obj.country) lines.push(obj.country);
    return lines;
  } catch {
    return raw.split("\n").map(l => l.trim()).filter(Boolean);
  }
}

function parseAddressName(raw: string | null, fallback: string | null): string | null {
  if (!raw) return fallback;
  try {
    const obj = JSON.parse(raw);
    const name = [obj.firstName, obj.lastName].filter(Boolean).join(" ");
    return name || fallback;
  } catch {
    return fallback;
  }
}

function generatePackingSlip(params: {
  orderNumber:    string;
  trackingNumber: string;
  carrier:        string;
  service:        string;
  shipDate:       string;
  shipFrom:       Props["shipFrom"];
  shipTo:         Props["shipTo"];
  items:          OrderItem[];
  subtotal:       number;
  shippingCost:   number;
}) {
  const { orderNumber, trackingNumber, carrier, service, shipDate, shipFrom, shipTo, items, subtotal, shippingCost } = params;
  const total = subtotal + shippingCost;
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const displayAddr = parseAddressLines(shipTo.address ?? null);
  const resolvedName = parseAddressName(shipTo.address ?? null, shipTo.name ?? null);

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">${it.title ?? "—"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#666">${it.variantSize ?? "—"} ${it.sku ? `· ${it.sku}` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(it.unitPrice ?? 0)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${fmt(it.lineTotal ?? 0)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Packing Slip – ${orderNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 32px; }
    @media print { body { padding: 16px; } .no-print { display: none; } }
    h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .badge { display: inline-block; background: #3DBFA4; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; margin-left: 10px; vertical-align: middle; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .box h3 { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .box p { font-size: 13px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f9fafb; }
    thead th { padding: 9px 10px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
    thead th:last-child, thead th:nth-child(3) { text-align: right; }
    thead th:nth-child(3) { text-align: center; }
    .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
    .totals table { width: 220px; }
    .totals td { padding: 5px 0; font-size: 13px; }
    .totals td:last-child { text-align: right; font-weight: 600; }
    .total-row td { font-size: 15px; font-weight: 800; border-top: 2px solid #1a1a1a; padding-top: 8px; }
    .tracking-box { margin-top: 24px; border: 1.5px dashed #3DBFA4; border-radius: 8px; padding: 14px 16px; display: flex; gap: 32px; align-items: center; }
    .tracking-box .label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
    .tracking-box .value { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
    .print-btn { margin-top: 24px; display: inline-flex; align-items: center; gap: 8px; background: #1a1a1a; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Pronuvia <span class="badge">Packing Slip</span></h1>
      <p style="margin-top:6px;color:#6b7280">Order #${orderNumber} &nbsp;·&nbsp; ${formatDateLong(shipDate)}</p>
    </div>
    <button class="print-btn no-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>

  <hr/>

  <div class="grid2">
    <div class="box">
      <h3>Ship From</h3>
      <p><strong>${shipFrom.name}</strong></p>
      <p>${shipFrom.street}</p>
      <p>${shipFrom.city}, ${shipFrom.state} ${shipFrom.zip}</p>
      <p>${shipFrom.country}</p>
    </div>
    <div class="box">
      <h3>Ship To</h3>
      ${resolvedName ? `<p><strong>${resolvedName}</strong></p>` : ""}
      ${displayAddr.map(l => `<p>${l}</p>`).join("")}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Variation / SKU</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>Shipping</td><td>${shippingCost > 0 ? fmt(shippingCost) : "Free"}</td></tr>
      <tr class="total-row"><td>Total</td><td>${fmt(total)}</td></tr>
    </table>
  </div>

  <div class="tracking-box">
    <div>
      <div class="label">Tracking Number</div>
      <div class="value">${trackingNumber}</div>
    </div>
    <div>
      <div class="label">Carrier & Service</div>
      <div class="value">${carrier} – ${service}</div>
    </div>
  </div>

  <p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center">Thank you for your order — Pronuvia</p>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function toLbs(val: number, unit: WeightUnit): number {
  if (unit === "kg")  return val * 2.20462;
  if (unit === "oz")  return val * 0.0625;
  if (unit === "g")   return val * 0.00220462;
  return val;
}

function cmToIn(cm: number) { return cm / 2.54; }

function trackUrl(carrier: string, tracking: string) {
  const c = carrier.toLowerCase();
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} tracking ${tracking}`)}`;
}

function CarrierBadge({ carrier }: { carrier: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    fedex: { bg: "#4D148C", text: "#fff",    label: "FedEx" },
    ups:   { bg: "#351C15", text: "#FFB500", label: "UPS"   },
    usps:  { bg: "#333366", text: "#fff",    label: "USPS"  },
  };
  const s = map[carrier.toLowerCase()] ?? { bg: "#6b7280", text: "#fff", label: carrier.toUpperCase() };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ── Shipment detail view ──────────────────────────────────────────────────────

function ShipmentDetail({ s, index, shipFrom, shipTo, items, subtotal, orderNumber }: {
  s: Shipment; index: number;
  shipFrom: Props["shipFrom"]; shipTo: Props["shipTo"];
  items: OrderItem[]; subtotal: number; orderNumber: string;
}) {
  const [showLabel, setShowLabel] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-emerald-800">Shipment {index + 1} — label ready</p>
            {s.isReturn && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-700">
                RETURN
              </span>
            )}
          </div>
          <p className="text-xs text-emerald-600">
            {formatDateLong(s.shipDate)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Carrier",       content: <div className="flex items-center gap-2"><CarrierBadge carrier={s.carrier} /><span className="text-sm text-gray-700">{s.service}</span></div> },
          { label: "Shipping Cost", content: <span className="text-sm font-bold text-gray-900">{fmt(s.cost)}</span> },
          { label: "Label Size",    content: <span className="text-sm text-gray-700">{s.labelSize === "LETTER" ? "8.5 × 11" : "4 × 6"}</span> },
          { label: "Tracking",      content: (
            <a href={trackUrl(s.carrier, s.trackingNumber)} target="_blank" rel="noopener noreferrer"
              className="text-sm font-mono font-semibold text-[#3DBFA4] hover:underline inline-flex items-center gap-1">
              {s.trackingNumber}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )},
          { label: "Format",        content: <span className="text-sm text-gray-700">{s.labelFormat}</span> },
        ].map(({ label, content }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
            {content}
          </div>
        ))}
      </div>
      {s.labelBase64 && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button type="button"
              onClick={() => {
                const win = window.open("", "_blank", "width=600,height=800");
                if (!win) return;
                if (s.labelFormat === "PDF") {
                  win.document.write(`<html><body style="margin:0"><embed src="data:application/pdf;base64,${s.labelBase64}" width="100%" height="100%" type="application/pdf"/></body></html>`);
                } else {
                  win.document.write(`<html><head><style>*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center}img{max-width:100%}@media print{body{display:block}}</style></head><body><img src="data:image/png;base64,${s.labelBase64}" onload="window.print()"/></body></html>`);
                }
                win.document.close();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
              </svg>
              Print Label
            </button>
            <button type="button" onClick={() => setShowLabel(!showLabel)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
              {showLabel ? "Hide" : "View"} Label
            </button>
            <button type="button"
              onClick={() => generatePackingSlip({
                orderNumber,
                trackingNumber: s.trackingNumber,
                carrier:   s.carrierLabel,
                service:   s.service,
                shipDate:  s.shipDate.toString(),
                shipFrom, shipTo, items, subtotal,
                shippingCost: s.cost,
              })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Packing Slip
            </button>
          </div>
          {showLabel && s.labelFormat === "PNG" && (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-w-xs">
              <img src={`data:image/png;base64,${s.labelBase64}`} alt="Shipping Label" className="w-full" />
            </div>
          )}
          {showLabel && s.labelFormat === "PDF" && (
            <a href={`data:application/pdf;base64,${s.labelBase64}`} download={`label-${s.trackingNumber}.pdf`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#3DBFA4] border border-gray-900 rounded-lg hover:bg-gray-900/5 transition-colors">
              Download PDF Label
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add shipment form ─────────────────────────────────────────────────────────

type PkgTab = "custom" | "carrier" | "saved";

function AddShipmentForm({ orderId, orderNumber, items, shipTo, shipFrom, orderValue, subtotal, shippingRate, shippingCarrier, shippingMethod, testModeCarriers, mode = "outbound" }: {
  orderId: string; orderNumber: string; items: OrderItem[]; orderValue: number; subtotal: number;
  shippingRate: number; shippingCarrier: string | null; shippingMethod?: string | null;
  shipTo: Props["shipTo"]; shipFrom: Props["shipFrom"];
  testModeCarriers?: Props["testModeCarriers"];
  mode?: ShipmentDirection;
}) {
  const router = useRouter();
  const isReturn = mode === "return";
  const expedited = !isReturn && isExpeditedMethod(shippingMethod);
  // FedEx return labels aren't supported — keep it out of the carrier picker
  // entirely in return mode so it can't even be selected.
  const CARRIER_OPTIONS: CarrierCode[] = isReturn ? ["ups", "usps"] : ["fedex", "ups", "usps"];

  // Items selection
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set(items.map((_, i) => i)));

  // Package tab
  const [pkgTab, setPkgTab] = useState<PkgTab>("custom");

  // Custom package
  const [pkgType,   setPkgType]   = useState<PkgType>("Box");
  const [lengthCm,  setLengthCm]  = useState("");
  const [widthCm,   setWidthCm]   = useState("");
  const [heightCm,  setHeightCm]  = useState("");
  const [saveAsTemplate,    setSaveAsTemplate]    = useState(false);
  const [templateName,      setTemplateName]      = useState("");

  // Carrier package
  const [selectedCarrierPkg, setSelectedCarrierPkg] = useState<CarrierPkg | null>(null);

  // Saved templates (localStorage)
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pronuvia_pkg_templates");
      if (raw) setSavedTemplates(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Dimension unit
  const [dimUnit, setDimUnit] = useState<"cm" | "in">("cm");

  // Weight
  const [weight,     setWeight]     = useState("1");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");

  // Ship date
  const today = toDateInputValue(new Date());
  const [shipDate, setShipDate] = useState(today);

  // Rates
  const [selectedCarriers,     setSelectedCarriers]     = useState<CarrierCode[]>(isReturn ? ["ups", "usps"] : ["fedex", "ups", "usps"]);
  const [selectedSignatureCode, setSelectedSignatureCode] = useState<number | null>(null);
  // Label format — 4x6 for a thermal printer, Letter for a normal paper printer
  const [labelSize, setLabelSize] = useState<LabelSize>("4X6");
  const [rates,        setRates]        = useState<RateResult[] | null>(null);
  const [selectedRate, setSelectedRate] = useState<RateResult | null>(null);
  const [rateError,    setRateError]    = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchased,    setPurchased]    = useState<{ trackingNumber: string; labelBase64: string; labelFormat: string; cost: number } | null>(null);

  const [isGettingRates, startGetRates] = useTransition();
  const [isPurchasing,   startPurchase] = useTransition();

  const toggleCarrier = (code: CarrierCode) =>
    setSelectedCarriers(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);

  function buildPkg(): PackageInfo | null {
    const wLbs = toLbs(parseFloat(weight) || 0, weightUnit);
    if (wLbs <= 0) return null;

    if (pkgTab === "custom") {
      const toIn = (v: string) => {
        const n = parseFloat(v);
        return isNaN(n) ? undefined : dimUnit === "cm" ? cmToIn(n) : n;
      };
      return {
        weightLbs: wLbs,
        lengthIn: lengthCm ? toIn(lengthCm) : undefined,
        widthIn:  widthCm  ? toIn(widthCm)  : undefined,
        heightIn: heightCm ? toIn(heightCm) : undefined,
      };
    }
    if (pkgTab === "carrier" && selectedCarrierPkg) {
      return {
        weightLbs: wLbs,
        lengthIn:  cmToIn(selectedCarrierPkg.lCm),
        widthIn:   cmToIn(selectedCarrierPkg.wCm),
        heightIn:  cmToIn(selectedCarrierPkg.hCm),
      };
    }
    if (pkgTab === "saved" && selectedTemplate) {
      return {
        weightLbs: wLbs,
        lengthIn:  cmToIn(selectedTemplate.lengthCm),
        widthIn:   cmToIn(selectedTemplate.widthCm),
        heightIn:  cmToIn(selectedTemplate.heightCm),
      };
    }
    return { weightLbs: wLbs };
  }

  function saveTemplate() {
    if (!templateName.trim()) { toast.error("Enter a template name."); return; }
    const t: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      type: pkgType,
      lengthCm: parseFloat(lengthCm) || 0,
      widthCm:  parseFloat(widthCm)  || 0,
      heightCm: parseFloat(heightCm) || 0,
    };
    const next = [...savedTemplates, t];
    setSavedTemplates(next);
    localStorage.setItem("pronuvia_pkg_templates", JSON.stringify(next));
    toast.success("Template saved!");
    setSaveAsTemplate(false);
    setTemplateName("");
  }

  function deleteTemplate(id: string) {
    const next = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(next);
    localStorage.setItem("pronuvia_pkg_templates", JSON.stringify(next));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  }

  function handleGetRates() {
    if (selectedCarriers.length === 0) { toast.error("Select at least one carrier."); return; }
    const pkg = buildPkg();
    if (!pkg) { toast.error("Enter a valid package weight."); return; }
    if (pkgTab === "carrier" && !selectedCarrierPkg) { toast.error("Select a carrier package."); return; }
    setRates(null); setSelectedRate(null); setRateError(null); setSelectedSignatureCode(null);
    startGetRates(async () => {
      try {
        const res = await getShippingRates(orderId, pkg, selectedCarriers, undefined, mode);
        if (res.error) setRateError(res.error);
        if (res.rates.length > 0) {
          setRates(res.rates);
          // If the customer paid for FedEx 2Day at checkout, default to that
          // rate instead of the cheapest one so the admin doesn't have to
          // remember to hunt for it in the list.
          const matched = expedited ? findMatchingRate(res.rates) : undefined;
          setSelectedRate(matched ?? res.rates[0]);
        }
        else if (!res.error) setRateError("No rates returned. Check credentials and package details.");
      } catch (e) {
        setRateError(e instanceof Error ? e.message : "Failed to get rates. Check server logs.");
      }
    });
  }

  function handlePurchase() {
    if (!selectedRate) { toast.error("Select a rate first."); return; }
    if (selectedRate.carrier === "usps" && labelSize === "LETTER") {
      toast.error("USPS doesn't support 8.5×11 labels — switch to 4×6, or pick a UPS rate for Letter size.");
      return;
    }
    const pkg = buildPkg();
    if (!pkg) { toast.error("Invalid package weight."); return; }
    setPurchaseError(null);
    startPurchase(async () => {
      try {
        const res = await purchaseLabel(orderId, pkg, selectedRate.carrier, selectedRate.serviceCode, selectedRate.service, undefined, selectedSignatureCode ?? 0, mode, labelSize);
        if (res.success && res.shipment) {
          setPurchased(res.shipment);
          toast.success(res.message);
          router.refresh();
        } else {
          const message = res.message || "Label purchase failed. Check server logs for details.";
          const visibleMessage = selectedRate.carrier === "usps"
            ? `USPS label purchase failed: ${message}`
            : message;
          setPurchaseError(visibleMessage);
          toast.error(visibleMessage);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "An unexpected error occurred purchasing the label.";
        const visibleMessage = selectedRate.carrier === "usps"
          ? `USPS label purchase failed: ${message}`
          : message;
        setPurchaseError(visibleMessage);
        toast.error(visibleMessage);
      }
    });
  }

  function printLabel(base64: string, format: string) {
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    if (format === "PDF") {
      win.document.write(`<html><body style="margin:0"><embed src="data:application/pdf;base64,${base64}" width="100%" height="100%" type="application/pdf"/></body></html>`);
    } else {
      win.document.write(`<html><head><style>*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center}img{max-width:100%}@media print{body{display:block}}</style></head><body><img src="data:image/png;base64,${base64}" onload="window.print()"/></body></html>`);
    }
    win.document.close();
  }

  if (purchased) {
    return (
      <div className="space-y-4 max-w-sm mx-auto text-center">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-bold text-emerald-800">{isReturn ? "Return label purchased!" : "Shipment purchased!"}</p>
          <p className="text-sm font-mono text-emerald-600 mt-1">{purchased.trackingNumber}</p>
          <p className="text-xs text-emerald-500 mt-0.5">Cost: {fmt(purchased.cost)}</p>
        </div>

        {purchased.labelBase64 && (
          <>
            {purchased.labelFormat === "PNG" && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <img src={`data:image/png;base64,${purchased.labelBase64}`} alt="Label" className="w-full" />
              </div>
            )}
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => printLabel(purchased.labelBase64!, purchased.labelFormat)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                </svg>
                Print Label
              </button>
              {purchased.labelFormat === "PDF" ? (
                <a href={`data:application/pdf;base64,${purchased.labelBase64}`} download={`label-${purchased.trackingNumber}.pdf`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </a>
              ) : (
                <a href={`data:image/png;base64,${purchased.labelBase64}`} download={`label-${purchased.trackingNumber}.png`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PNG
                </a>
              )}
              <button
                onClick={() => generatePackingSlip({
                  orderNumber,
                  trackingNumber: purchased.trackingNumber,
                  carrier:   purchased.labelFormat === "PNG" ? "FedEx" : "Carrier",
                  service:   selectedRate?.service ?? "",
                  shipDate:  new Date().toISOString(),
                  shipFrom,
                  shipTo,
                  items,
                  subtotal,
                  shippingCost: purchased.cost,
                })}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Packing Slip
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const testCarrierNames: string[] = [];
  if (testModeCarriers?.ups)   testCarrierNames.push("UPS");
  if (testModeCarriers?.fedex) testCarrierNames.push("FedEx");
  if (testModeCarriers?.usps)  testCarrierNames.push("USPS");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">

      {/* ── Sandbox / test-mode banner ── */}
      {testCarrierNames.length > 0 && (
        <div className="xl:col-span-2 flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="text-sm">
            <p className="font-semibold text-amber-800">
              {testCarrierNames.join(" & ")} {testCarrierNames.length === 1 ? "is" : "are"} connected to the sandbox / test environment.
            </p>
            <p className="text-amber-700 mt-0.5">
              Rate quotes work, but label purchase may fail or return test tracking numbers that cannot be used for real shipments.
              To go live, update <code className="font-mono bg-amber-100 px-1 rounded">UPS_API_URL</code> / <code className="font-mono bg-amber-100 px-1 rounded">FEDEX_API_URL</code> in <code className="font-mono bg-amber-100 px-1 rounded">.env</code> to the production endpoints and supply production credentials.
            </p>
          </div>
        </div>
      )}

      {/* ── Customer's checkout selection ── */}
      {shippingMethod && (
        <div className={`xl:col-span-2 rounded-xl border px-4 py-3 flex items-center gap-2.5 ${
          expedited ? "bg-orange-50 border-orange-300" : "bg-gray-50 border-gray-200"
        }`}>
          <svg className={`w-4 h-4 shrink-0 ${expedited ? "text-orange-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div>
            <p className={`text-sm font-bold ${expedited ? "text-orange-700" : "text-gray-700"}`}>
              Customer selected: {shippingMethod}
            </p>
            {expedited && (
              <p className="text-xs text-orange-600 mt-0.5">Buy the matching FedEx 2Day label below — it&apos;s pre-selected once rates load.</p>
            )}
          </div>
        </div>
      )}

      {/* ── LEFT ── */}
      <div className="space-y-6">

        {/* 1. Items */}
        <section>
          <h3 className="text-sm font-bold text-gray-800 mb-3">Items</h3>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
              <p className="text-xs text-blue-700">
                Select the items you want to include in this shipment.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-8 px-3 py-2.5">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={selectedItems.size === items.length}
                      onChange={e => setSelectedItems(e.target.checked ? new Set(items.map((_, i) => i)) : new Set())} />
                  </th>
                  {["Product", "QTY", "Variation", "Weight", "Price"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className={`border-b border-gray-50 last:border-0 transition-colors ${selectedItems.has(i) ? "bg-white" : "bg-gray-50/50 opacity-50"}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" className="rounded border-gray-300"
                        checked={selectedItems.has(i)}
                        onChange={e => {
                          const next = new Set(selectedItems);
                          e.target.checked ? next.add(i) : next.delete(i);
                          setSelectedItems(next);
                        }} />
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-800 max-w-[180px]">
                      <span className="line-clamp-2">{item.title}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-3 text-gray-500">{item.variantSize || "—"}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">—</td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{fmt(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedItems.size > 0 && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                {selectedItems.size} of {items.length} item{items.length !== 1 ? "s" : ""} selected
                <button type="button" onClick={() => setSelectedItems(new Set())}
                  className="ml-3 text-red-400 hover:text-red-500 font-medium">
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 2. Package */}
        <section>
          <h3 className="text-sm font-bold text-gray-800 mb-3">Package</h3>
          <div className="border border-gray-100 rounded-xl overflow-hidden">

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {([["custom", "Custom package"], ["carrier", "Carrier package"], ["saved", "Saved templates"]] as [PkgTab, string][]).map(([t, label]) => (
                <button key={t} type="button" onClick={() => setPkgTab(t)}
                  className={`flex-1 px-4 py-3 text-xs font-semibold transition-colors ${
                    pkgTab === t
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">

              {/* Custom package */}
              {pkgTab === "custom" && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Package Type</label>
                    <select value={pkgType} onChange={e => setPkgType(e.target.value as PkgType)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 bg-white">
                      {(["Box", "Envelope", "Tube", "Pak", "Other"] as PkgType[]).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-gray-500">Dimensions</label>
                      <div className="flex items-center rounded-md overflow-hidden border border-gray-200 text-xs font-semibold">
                        {(["cm", "in"] as const).map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setDimUnit(u)}
                            className={`px-2.5 py-1 transition-colors ${
                              dimUnit === u
                                ? "bg-gray-900 text-white"
                                : "text-gray-400 hover:text-gray-600 bg-white"
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { p: "Length", v: lengthCm, s: setLengthCm },
                        { p: "Width",  v: widthCm,  s: setWidthCm  },
                        { p: "Height", v: heightCm, s: setHeightCm },
                      ].map(({ p, v, s }) => (
                        <div key={p} className="relative">
                          <input type="number" min="0" step="0.1" placeholder={p} value={v}
                            onChange={e => s(e.target.value)}
                            className="w-full px-3 py-2.5 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 placeholder:text-gray-300 bg-white" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-medium pointer-events-none">
                            {dimUnit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="save-tpl" checked={saveAsTemplate}
                      onChange={e => setSaveAsTemplate(e.target.checked)}
                      className="rounded border-gray-300" />
                    <label htmlFor="save-tpl" className="text-xs text-gray-600 cursor-pointer">Save this template</label>
                  </div>
                  {saveAsTemplate && (
                    <div className="flex gap-2">
                      <input type="text" placeholder="Template name" value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 bg-white" />
                      <button type="button" onClick={saveTemplate}
                        className="px-3 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors">
                        Save
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Carrier packages */}
              {pkgTab === "carrier" && (
                <div className="space-y-4">
                  {/* Carrier tabs */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    {CARRIER_OPTIONS.map(c => {
                      const colors: Record<string, string> = { fedex: "#4D148C", ups: "#351C15", usps: "#333366" };
                      const inCarrier = selectedCarriers.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleCarrier(c)}
                          className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${inCarrier ? "text-white shadow-sm" : "text-gray-400"}`}
                          style={inCarrier ? { backgroundColor: colors[c] } : {}}>
                          {c.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>

                  {CARRIER_PACKAGES
                    .filter(g => selectedCarriers.includes(g.carrier))
                    .map(group => (
                      <div key={group.group}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{group.group}</p>
                        <div className="space-y-1">
                          {group.packages.map(pkg => {
                            const active = selectedCarrierPkg?.id === pkg.id;
                            return (
                              <button key={pkg.id} type="button" onClick={() => setSelectedCarrierPkg(active ? null : pkg)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                                  active ? "border-gray-900 bg-gray-900/5" : "border-gray-100 hover:border-gray-200"}`}>
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? "border-gray-900" : "border-gray-300"}`}>
                                    {active && <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                                  </div>
                                  <span className="font-medium text-gray-800">{pkg.name}</span>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">
                                  {pkg.lCm} × {pkg.wCm} × {pkg.hCm} cm
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Saved templates */}
              {pkgTab === "saved" && (
                savedTemplates.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-sm text-gray-400">No saved templates yet.</p>
                    <p className="text-xs text-gray-300 mt-0.5">Save a custom package as template.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {savedTemplates.map(t => {
                      const active = selectedTemplate?.id === t.id;
                      return (
                        <div key={t.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${active ? "border-gray-900 bg-gray-900/5" : "border-gray-100 hover:border-gray-200"}`}>
                          <button type="button" className="flex items-center gap-2.5 flex-1 text-left" onClick={() => setSelectedTemplate(active ? null : t)}>
                            <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? "border-gray-900" : "border-gray-300"}`}>
                              {active && <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{t.name}</p>
                              <p className="text-xs text-gray-400">{t.type} · {t.lengthCm} × {t.widthCm} × {t.heightCm} cm</p>
                            </div>
                          </button>
                          <button type="button" onClick={() => deleteTemplate(t.id)}
                            className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Weight — always visible */}
              <div className="pt-2 border-t border-gray-100">
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Total shipment weight <span className="text-gray-400">(with package)</span>
                </label>
                <div className="flex gap-2">
                  <input type="number" min="0.01" step="0.01" value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 bg-white" />
                  <select value={weightUnit} onChange={e => setWeightUnit(e.target.value as WeightUnit)}
                    className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-gray-900 bg-white">
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                    <option value="oz">oz</option>
                    <option value="g">g</option>
                  </select>
                </div>
              </div>

              {/* Carrier selection (for custom/saved tabs) */}
              {pkgTab !== "carrier" && (
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Carrier</label>
                  <div className="flex gap-2">
                    {CARRIER_OPTIONS.map(c => {
                      const colors: Record<string, string> = { fedex: "#4D148C", ups: "#351C15", usps: "#333366" };
                      const active = selectedCarriers.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleCarrier(c)}
                          className="flex-1 py-2 text-xs font-black rounded-lg border-2 transition-all"
                          style={active
                            ? { backgroundColor: colors[c], borderColor: colors[c], color: c === "ups" ? "#FFB500" : "#fff" }
                            : { backgroundColor: "#f9fafb", borderColor: "#e5e7eb", color: "#9ca3af" }}>
                          {c.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Label format */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Label format
                  {selectedRate?.carrier === "usps" && labelSize === "LETTER" && (
                    <span className="text-amber-600 font-medium"> — USPS only supports 4×6, this rate needs UPS</span>
                  )}
                </label>
                <div className="flex gap-2">
                  {([
                    { value: "4X6" as LabelSize,   title: "4 × 6",     subtitle: "Thermal printer — UPS & USPS" },
                    { value: "LETTER" as LabelSize, title: "8.5 × 11", subtitle: "Normal paper printer — UPS only" },
                  ]).map(opt => {
                    const active = labelSize === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setLabelSize(opt.value)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg border-2 transition-all ${
                          active ? "border-gray-900 bg-gray-900/5" : "border-gray-100 hover:border-gray-200"}`}>
                        <span className="text-sm font-bold text-gray-800">{opt.title}</span>
                        <span className="text-[10px] text-gray-400">{opt.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Get rates button */}
              <button type="button" onClick={handleGetRates}
                disabled={isGettingRates || selectedCarriers.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-xl transition-colors">
                {isGettingRates
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Getting rates…</>
                  : <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Get shipping rates
                    </>}
              </button>
            </div>
          </div>
        </section>

        {/* 3. Error */}
        {rateError && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-2.5 items-start">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600">{rateError}</p>
          </div>
        )}

        {purchaseError && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {purchaseError}
          </div>
        )}

        {/* 4. Shipping service rates */}
        {rates && rates.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Shipping service</h3>
            <div className="space-y-2">
              {rates.map((r, i) => {
                const active = selectedRate?.serviceCode === r.serviceCode && selectedRate?.carrier === r.carrier;
                const matchesChoice = expedited && r.carrier === "fedex" && /2\s*day/i.test(r.service);
                const sigAddOn = active && selectedSignatureCode != null
                  ? (r.signatureOptions?.find(o => o.code === selectedSignatureCode)?.price ?? 0)
                  : 0;
                return (
                  <div key={i} className={`rounded-xl border-2 transition-all ${
                    active ? "border-gray-900 bg-gray-900/5" : matchesChoice ? "border-orange-200" : "border-gray-100 bg-white"}`}>

                    {/* Rate header row */}
                    <button type="button"
                      onClick={() => { setSelectedRate(r); setSelectedSignatureCode(null); }}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? "border-gray-900" : "border-gray-300"}`}>
                          {active && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CarrierBadge carrier={r.carrier} />
                            <span className="text-sm font-semibold text-gray-800">{r.service}</span>
                            {matchesChoice && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                                Customer&apos;s choice
                              </span>
                            )}
                          </div>
                          {r.deliveryDays != null && (
                            <p className="text-xs text-gray-400 mt-0.5">{r.deliveryDays} business day{r.deliveryDays !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-base font-bold text-gray-900 shrink-0">{fmt(r.totalCost + sigAddOn)}</span>
                    </button>

                    {/* Features + signature options (only on selected card) */}
                    {active && ((r.features?.length ?? 0) > 0 || (r.signatureOptions?.length ?? 0) > 0) && (
                      <div className="px-4 pb-3.5 border-t border-gray-100 pt-2.5 space-y-2">
                        {r.features?.map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {f}
                          </div>
                        ))}
                        {r.signatureOptions?.map(opt => (
                          <label key={opt.code} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={selectedSignatureCode === opt.code}
                              onChange={e => setSelectedSignatureCode(e.target.checked ? opt.code : null)}
                            />
                            <span className="text-xs text-gray-600">{opt.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">( +${opt.price.toFixed(2)} )</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedRate && (() => {
              const sigPrice = selectedSignatureCode != null
                ? (selectedRate.signatureOptions?.find(o => o.code === selectedSignatureCode)?.price ?? 0)
                : 0;
              return (
                <button type="button" onClick={handlePurchase} disabled={isPurchasing}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-4 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors">
                  {isPurchasing
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Purchasing shipment…</>
                    : <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {isReturn ? "Purchase Return Label" : "Purchase Shipment"} ({fmt(selectedRate.totalCost + sigPrice)})
                      </>}
                </button>
              );
            })()}
          </section>
        )}
      </div>

      {/* ── RIGHT SIDEBAR ── */}
      <div className="space-y-4 sticky top-32">

        {/* Order details */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 text-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order Details</p>
          <div className="space-y-2.5">
            {isReturn && (
              <div className="flex items-center gap-1.5 -mt-1 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-700">
                  RETURN LABEL
                </span>
                <span className="text-[10px] text-gray-400">customer → warehouse</span>
              </div>
            )}
            <Row label="Ship from" value={isReturn
              ? (() => {
                  const name = parseAddressName(shipTo.address ?? null, shipTo.name ?? null);
                  const lines = parseAddressLines(shipTo.address ?? null);
                  if (!lines.length && !name) return "No address on file";
                  return [name, ...lines].filter(Boolean).join(", ");
                })()
              : `${shipFrom.name}, ${shipFrom.city}, ${shipFrom.state} ${shipFrom.zip}`} />
            <Row label="Ship to" value={isReturn
              ? `${shipFrom.name}, ${shipFrom.city}, ${shipFrom.state} ${shipFrom.zip}`
              : (() => {
                  const name = parseAddressName(shipTo.address ?? null, shipTo.name ?? null);
                  const lines = parseAddressLines(shipTo.address ?? null);
                  if (!lines.length && !name) return "No address on file";
                  return [name, ...lines].filter(Boolean).join(", ");
                })()} />
            <div className="border-t border-gray-200 pt-2.5 space-y-2">
              <Row label="Number of items" value={String(items.length)} />
              <Row label="Order value"     value={fmt(orderValue)} bold />
              {shippingMethod && <Row label="Customer selected" value={shippingMethod} />}
              {shippingCarrier && <Row label="Shipping type" value={shippingCarrier} />}
              <Row label="Shipping cost"   value={fmt(shippingRate)} />
            </div>
          </div>
        </div>

        {/* Shipment details */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 text-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipment Details</p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500 shrink-0">Ship date</span>
              <div className="relative">
                <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)}
                  className="text-xs text-gray-800 font-medium border border-gray-200 rounded-lg pl-2 pr-7 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white" />
                <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            {selectedRate && (() => {
              const sigOpt = selectedSignatureCode != null
                ? selectedRate.signatureOptions?.find(o => o.code === selectedSignatureCode)
                : null;
              const sigPrice = sigOpt?.price ?? 0;
              return (
                <div className="border-t border-gray-200 pt-2.5 space-y-2">
                  <Row label={`${selectedRate.carrierLabel} - ${selectedRate.service}`} value={fmt(selectedRate.totalCost)} />
                  {sigOpt && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        {sigOpt.name}
                      </span>
                      <span className="text-xs text-blue-500 font-medium">+{fmt(sigOpt.price)}</span>
                    </div>
                  )}
                  <Row label="Total" value={fmt(selectedRate.totalCost + sigPrice)} bold />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 items-start">
      <span className="text-gray-500 shrink-0 text-xs">{label}</span>
      <span className={`text-right text-xs leading-relaxed ${bold ? "font-bold text-gray-900" : "text-gray-700 font-medium"}`}>{value}</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ShippingPageClient(props: Props) {
  const isReturn = props.mode === "return";
  const existingReturnIndex = props.shipments.findIndex((s) => s.isReturn);
  const [activeTab, setActiveTab] = useState<number | "add">(
    isReturn
      ? (existingReturnIndex !== -1 ? existingReturnIndex : "add")
      : (props.shipments.length > 0 ? 0 : "add")
  );

  return (
    <div className=" mx-auto space-y-5 px-4 py-6">

      <Link href={`/admin/orders/${props.orderId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Order {props.orderNumber}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isReturn ? "Create return label" : "Create shipping label"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Order {props.orderNumber}</p>
        </div>
        {props.shipments.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {props.shipments.length} shipment{props.shipments.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {/* Tabs */}
        <div className="border-b border-gray-100 px-6">
          <div className="flex items-center overflow-x-auto">
            {props.shipments.map((s, i) => (
              <button key={s.id} type="button" onClick={() => setActiveTab(i)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === i ? "border-gray-900 text-[#3DBFA4]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Shipment {i + 1}
              </button>
            ))}
            {!(isReturn && existingReturnIndex !== -1) && (
              <button type="button" onClick={() => setActiveTab("add")}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "add" ? "border-gray-900 text-[#3DBFA4]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {isReturn ? "Add return label" : "Add shipment"}
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {typeof activeTab === "number" && props.shipments[activeTab]
            ?   <ShipmentDetail s={props.shipments[activeTab]} index={activeTab} shipFrom={props.shipFrom} shipTo={props.shipTo} items={props.items} subtotal={props.subtotal} orderNumber={props.orderNumber} />
            : <AddShipmentForm
                orderId={props.orderId}
                orderNumber={props.orderNumber}
                items={props.items}
                shipTo={props.shipTo}
                shipFrom={props.shipFrom}
                orderValue={props.orderValue}
                subtotal={props.subtotal}
                shippingRate={props.shippingRate}
                shippingCarrier={props.shippingCarrier}
                shippingMethod={props.shippingMethod}
                testModeCarriers={props.testModeCarriers}
                mode={props.mode}
              />}
        </div>
      </div>
    </div>
  );
}
