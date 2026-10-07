"use client";

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import toast                       from "react-hot-toast";
import { getShippingRates, purchaseLabel } from "@/actions/admin/shipping";
import type { CarrierCode, PackageInfo, RateResult } from "@/lib/shipping/types";
import { formatDateLong } from "@/lib/utils/timezone";

type Shipment = {
  id:             string;
  carrier:        string;
  carrierLabel:   string;
  service:        string;
  trackingNumber: string;
  labelBase64:    string | null;
  labelFormat:    string;
  cost:           number;
  shipDate:       Date;
};

interface Props {
  orderId:   string;
  orderNumber: string;
  shipments: Shipment[];
  physician: { firstName: string; lastName: string; city: string | null; state: string | null } | null;
  itemCount: number;
  orderValue: number;
  // The option the customer selected at checkout, e.g. "FedEx 2Day Shipping"
  // — used to steer the admin toward buying the matching label.
  shippingMethod?: string | null;
}

function isExpeditedMethod(method: string | null | undefined): boolean {
  return !!method && method.includes("FedEx 2Day");
}

// Matches the live rate that corresponds to the customer's checkout choice —
// FedEx's "2Day" service in whatever casing/spacing the carrier API returns.
function findMatchingRate(rates: RateResult[]): RateResult | undefined {
  return rates.find((r) => r.carrier === "fedex" && /2\s*day/i.test(r.service));
}

const CARRIERS: { code: CarrierCode; label: string; color: string }[] = [
  { code: "fedex", label: "FedEx",  color: "#4D148C" },
  { code: "ups",   label: "UPS",    color: "#351C15" },
  { code: "usps",  label: "USPS",   color: "#333366" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function CarrierLogo({ carrier }: { carrier: string }) {
  const styles: Record<string, string> = {
    fedex: "bg-[#4D148C] text-white",
    ups:   "bg-[#351C15] text-[#FFB500]",
    usps:  "bg-[#333366] text-white",
  };
  const labels: Record<string, string> = { fedex: "FedEx", ups: "UPS", usps: "USPS" };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight ${styles[carrier] ?? "bg-gray-200 text-gray-700"}`}>
      {labels[carrier] ?? carrier.toUpperCase()}
    </span>
  );
}

// ── Existing shipment tab ─────────────────────────────────────────────────────
function ShipmentDetail({ s, index }: { s: Shipment; index: number }) {
  const [showLabel, setShowLabel] = useState(false);
  const trackUrl = (() => {
    const c = s.carrier.toLowerCase();
    if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${s.trackingNumber}`;
    if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${s.trackingNumber}`;
    if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${s.trackingNumber}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${s.carrier} tracking ${s.trackingNumber}`)}`;
  })();

  return (
    <div className="space-y-5">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-800">Shipment {index + 1} label is ready</p>
          <p className="text-xs text-emerald-600">Purchased on {formatDateLong(s.shipDate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Carrier</p>
          <div className="flex items-center gap-2">
            <CarrierLogo carrier={s.carrier} />
            <span className="text-sm text-gray-700">{s.service}</span>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracking</p>
          <a href={trackUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm font-mono font-semibold text-[#3DBFA4] hover:underline inline-flex items-center gap-1">
            {s.trackingNumber}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping Cost</p>
          <p className="text-sm font-bold text-gray-800">{fmt(s.cost)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Label Format</p>
          <p className="text-sm text-gray-700">{s.labelFormat}</p>
        </div>
      </div>

      {s.labelBase64 && (
        <div>
          <button type="button" onClick={() => setShowLabel(!showLabel)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {showLabel ? "Hide" : "Print"} Label ({s.labelFormat})
          </button>

          {showLabel && s.labelFormat === "PNG" && (
            <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
              <img src={`data:image/png;base64,${s.labelBase64}`} alt="Shipping Label" className="w-full max-w-sm" />
            </div>
          )}
          {showLabel && s.labelFormat === "PDF" && (
            <div className="mt-4">
              <a
                href={`data:application/pdf;base64,${s.labelBase64}`}
                download={`label-${s.trackingNumber}.pdf`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#3DBFA4] border border-gray-900 rounded-lg hover:bg-gray-900/5 transition-colors"
              >
                Download PDF Label
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Shipment form ─────────────────────────────────────────────────────────
function AddShipmentForm({
  orderId, orderValue, itemCount, physician, shippingMethod,
}: { orderId: string; orderValue: number; itemCount: number; physician: Props["physician"]; shippingMethod?: string | null }) {
  const router = useRouter();
  const expedited = isExpeditedMethod(shippingMethod);

  const [selectedCarriers,   setSelectedCarriers]   = useState<CarrierCode[]>(["fedex", "ups", "usps"]);
  const [weightLbs,          setWeightLbs]          = useState("0.5");
  const [lengthIn,           setLengthIn]           = useState("");
  const [widthIn,            setWidthIn]            = useState("");
  const [heightIn,           setHeightIn]           = useState("");
  const [selectedSignatureCode, setSelectedSignatureCode] = useState<number | null>(null);

  const [rates,        setRates]        = useState<RateResult[] | null>(null);
  const [selectedRate, setSelectedRate] = useState<RateResult | null>(null);
  const [rateError,    setRateError]    = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchased,    setPurchased]    = useState<{ trackingNumber: string; labelBase64: string; labelFormat: string; cost: number } | null>(null);

  const [isGettingRates, startGetRates]   = useTransition();
  const [isPurchasing,   startPurchase]   = useTransition();

  const toggleCarrier = (code: CarrierCode) =>
    setSelectedCarriers((p) =>
      p.includes(code) ? p.filter((c) => c !== code) : [...p, code]
    );

  const pkg: PackageInfo = {
    weightLbs: parseFloat(weightLbs) || 0.1,
    lengthIn:  lengthIn  ? parseFloat(lengthIn)  : undefined,
    widthIn:   widthIn   ? parseFloat(widthIn)   : undefined,
    heightIn:  heightIn  ? parseFloat(heightIn)  : undefined,
  };

  const handleGetRates = () => {
    if (selectedCarriers.length === 0) { toast.error("Select at least one carrier."); return; }
    setRates(null);
    setSelectedRate(null);
    setRateError(null);

    startGetRates(async () => {
      try {
        const res = await getShippingRates(orderId, pkg, selectedCarriers, undefined);
        if (res.error) setRateError(res.error);
        if (res.rates.length > 0) {
          setRates(res.rates);
          // If the customer paid for FedEx 2Day at checkout, default to that
          // rate instead of the cheapest one so the admin doesn't have to
          // remember to hunt for it in the list.
          const matched = expedited ? findMatchingRate(res.rates) : undefined;
          setSelectedRate(matched ?? res.rates[0]);
          setSelectedSignatureCode(null);
        } else if (!res.error) {
          setRateError("No rates returned. Check package details and carrier credentials.");
        }
      } catch (e) {
        setRateError(e instanceof Error ? e.message : "Failed to get rates. Check server logs.");
      }
    });
  };

  const handlePurchase = () => {
    if (!selectedRate) { toast.error("Select a rate first."); return; }
    setPurchaseError(null);
    startPurchase(async () => {
      try {
        const res = await purchaseLabel(orderId, pkg, selectedRate.carrier, selectedRate.serviceCode, selectedRate.service, undefined, selectedSignatureCode ?? 0);
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
  };

  if (purchased) {
    return (
      <div className="space-y-5">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-bold text-emerald-800">Label purchased!</p>
          <p className="text-sm text-emerald-600 mt-1 font-mono">{purchased.trackingNumber}</p>
          <p className="text-xs text-emerald-500 mt-0.5">Cost: {fmt(purchased.cost)}</p>
        </div>

        {purchased.labelBase64 && purchased.labelFormat === "PNG" && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <img src={`data:image/png;base64,${purchased.labelBase64}`} alt="Shipping Label" className="w-full max-w-sm mx-auto block" />
          </div>
        )}
        {purchased.labelBase64 && purchased.labelFormat === "PDF" && (
          <a
            href={`data:application/pdf;base64,${purchased.labelBase64}`}
            download={`label-${purchased.trackingNumber}.pdf`}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Download PDF Label
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

      {/* ── LEFT ── */}
      <div className="space-y-6">

        {/* Customer's checkout selection */}
        {shippingMethod && (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 ${
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

        {/* Carrier selection */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Carriers</h4>
          <div className="flex gap-3">
            {CARRIERS.map(({ code, label, color }) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleCarrier(code)}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                  selectedCarriers.includes(code)
                    ? "border-current text-white"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
                style={selectedCarriers.includes(code) ? { backgroundColor: color, borderColor: color } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Package dimensions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Package Details</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">Weight (lbs) *</label>
              <input
                type="number" min="0.01" step="0.01" value={weightLbs}
                onChange={(e) => setWeightLbs(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">
                Dimensions (inches) — <span className="text-gray-400">optional but recommended</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.1" placeholder="Length" value={lengthIn}
                  onChange={(e) => setLengthIn(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 placeholder:text-gray-300" />
                <span className="text-gray-300">×</span>
                <input type="number" min="0" step="0.1" placeholder="Width" value={widthIn}
                  onChange={(e) => setWidthIn(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 placeholder:text-gray-300" />
                <span className="text-gray-300">×</span>
                <input type="number" min="0" step="0.1" placeholder="Height" value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 placeholder:text-gray-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Get rates button */}
        <button
          type="button"
          onClick={handleGetRates}
          disabled={isGettingRates || selectedCarriers.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-xl transition-colors"
        >
          {isGettingRates
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Getting rates…</>
            : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg> Get Shipping Rates</>}
        </button>

        {/* Error */}
        {rateError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {rateError}
          </div>
        )}

        {purchaseError && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {purchaseError}
          </div>
        )}

        {/* Rates list */}
        {rates && rates.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Rates</h4>
            <div className="space-y-2">
              {rates.map((r, i) => {
                const active = selectedRate?.serviceCode === r.serviceCode && selectedRate?.carrier === r.carrier;
                const matchesChoice = expedited && r.carrier === "fedex" && /2\s*day/i.test(r.service);
                const sigAddOn = active && selectedSignatureCode
                  ? (r.signatureOptions?.find(o => o.code === selectedSignatureCode)?.price ?? 0)
                  : 0;
                return (
                  <div key={i} className={`rounded-xl border-2 transition-all ${active ? "border-gray-900 bg-gray-900/5" : matchesChoice ? "border-orange-200" : "border-gray-100 bg-white"}`}>
                    <button
                      type="button"
                      onClick={() => { setSelectedRate(r); setSelectedSignatureCode(null); }}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? "border-gray-900" : "border-gray-300"}`}>
                          {active && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CarrierLogo carrier={r.carrier} />
                            <span className="text-sm font-semibold text-gray-800">{r.service}</span>
                            {matchesChoice && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                                Customer&apos;s choice
                              </span>
                            )}
                          </div>
                          {r.deliveryDays && (
                            <p className="text-xs text-gray-400 mt-0.5">{r.deliveryDays} business day{r.deliveryDays !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-base font-bold text-gray-900">{fmt(r.totalCost + sigAddOn)}</span>
                    </button>
                    {active && ((r.features?.length ?? 0) > 0 || (r.signatureOptions?.length ?? 0) > 0) && (
                      <div className="px-4 pb-3.5 border-t border-gray-100 pt-2.5 space-y-2">
                        {r.features?.map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
              const sigPrice = selectedSignatureCode
                ? (selectedRate.signatureOptions?.find(o => o.code === selectedSignatureCode)?.price ?? 0)
                : 0;
              return (
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={isPurchasing}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {isPurchasing
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Purchasing label…</>
                    : <>Purchase Label — {fmt(selectedRate.totalCost + sigPrice)}</>}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── RIGHT: Order summary ── */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-5 text-sm">
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order details</h4>
          <div className="space-y-2.5">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Ship to</span>
              {/* <span className="text-gray-800 font-medium text-right">
                {physician
                  ? ` ${physician.firstName} ${physician.lastName}${physician.city ? `, ${physician.city}` : ""}${physician.state ? `, ${physician.state}` : ""}`
                  : "No address"}
              </span> */}
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Items</span>
              <span className="text-gray-800 font-medium">{itemCount}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Order value</span>
              <span className="text-gray-800 font-medium">{fmt(orderValue)}</span>
            </div>
          </div>
        </div>

        {(weightLbs || lengthIn) && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Package</h4>
            <div className="space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Weight</span>
                <span className="text-gray-800 font-medium">{parseFloat(weightLbs) || 0} lbs</span>
              </div>
              {lengthIn && widthIn && heightIn && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Dimensions</span>
                  <span className="text-gray-800 font-medium">{lengthIn} × {widthIn} × {heightIn} in</span>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedRate && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Selected rate</h4>
            <div className="space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Carrier</span>
                <CarrierLogo carrier={selectedRate.carrier} />
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Service</span>
                <span className="text-gray-800 font-medium text-right">{selectedRate.service}</span>
              </div>
              {selectedSignatureCode && (() => {
                const sigOpt = selectedRate.signatureOptions?.find(o => o.code === selectedSignatureCode);
                return sigOpt ? (
                  <div className="flex justify-between gap-2 text-xs text-amber-600">
                    <span>{sigOpt.name}</span>
                    <span>+{fmt(sigOpt.price)}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between gap-2 pt-1 border-t border-gray-200">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-gray-900">{fmt(selectedRate.totalCost + (selectedSignatureCode ? (selectedRate.signatureOptions?.find(o => o.code === selectedSignatureCode)?.price ?? 0) : 0))}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel (modal trigger + overlay) ─────────────────────────────────────
export function ShippingPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number | "add">(
    props.shipments.length > 0 ? 0 : "add"
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-lg shadow-sm transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 001 1v10l2-1m7 1V7.5M16 7.5L13 6" />
        </svg>
        View / Add Shipment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl">

            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Tabs */}
            <div className="border-b border-gray-100 px-6">
              <div className="flex items-center gap-1 overflow-x-auto">
                {props.shipments.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveTab(i)}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === i
                        ? "border-gray-900 text-[#3DBFA4]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Shipment {i + 1}/{props.shipments.length}
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveTab("add")}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === "add"
                      ? "border-gray-900 text-[#3DBFA4]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add shipment
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {typeof activeTab === "number" && props.shipments[activeTab] ? (
                <ShipmentDetail s={props.shipments[activeTab]} index={activeTab} />
              ) : (
                <AddShipmentForm
                  orderId={props.orderId}
                  orderValue={props.orderValue}
                  itemCount={props.itemCount}
                  physician={props.physician}
                  shippingMethod={props.shippingMethod}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
