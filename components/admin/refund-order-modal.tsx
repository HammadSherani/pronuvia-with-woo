"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { processReturn, type RefundLineItem, type CustomerRefundPayload } from "@/actions/admin/manage-orders";

type OrderItem = {
  title:       string;
  variantSize: string;
  sku:         string;
  quantity:    number;
  unitPrice:   number;
  lineTotal:   number;
};

interface Props {
  orderId:                   string;
  orderNumber:               string;
  total:                     number;
  shippingRate:              number;
  items:                     OrderItem[];
  alreadyRefunded:           number[];
  existingSalesRepClawback:  number;
  existingPhysicianClawback: number;
  salesRepName?:             string | null;
  physicianName?:            string | null;
  salesRepCommissionAmount:  number;
  physicianCommissionAmount: number;
  commissionPaid:            boolean;
  salesRepWalletBalance?:    number | null;
  physicianWalletBalance?:   number | null;
  stripePaymentIntentId?:    string | null;
  paymentMethod?:            string | null;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtBalance(n: number) {
  const cls = n < 0 ? "text-red-600" : "text-gray-600";
  return <span className={cls}>{fmt(n)}</span>;
}

export function RefundOrderModal({
  orderId, orderNumber, total, shippingRate, items,
  alreadyRefunded, existingSalesRepClawback, existingPhysicianClawback,
  salesRepName, physicianName,
  salesRepCommissionAmount, physicianCommissionAmount,
  commissionPaid,
  salesRepWalletBalance, physicianWalletBalance,
  stripePaymentIntentId, paymentMethod,
}: Props) {
  const router  = useRouter();
  const [open,            setOpen]          = useState(false);
  const [quantities,      setQtys]          = useState<number[]>(() =>
    items.map((item, idx) => Math.max(0, item.quantity - (alreadyRefunded[idx] ?? 0)))
  );
  const [reason,          setReason]        = useState("");
  const [custMethod,      setCustMethod]    = useState<"manual" | "stripe">("manual");
  const [custAmount,      setCustAmount]    = useState<string>("");
  const [includeShipping, setIncludeShipping] = useState(false);
  const [isPending,       start]            = useTransition();
  const overlayRef                          = useRef<HTMLDivElement>(null);

  const canStripe = !!(stripePaymentIntentId && paymentMethod === "CARD");

  const maxByIdx = items.map((item, idx) => Math.max(0, item.quantity - (alreadyRefunded[idx] ?? 0)));

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      setQtys(items.map((item, idx) => Math.max(0, item.quantity - (alreadyRefunded[idx] ?? 0))));
      setCustMethod("manual");
      setCustAmount("");
      setIncludeShipping(false);
    }
  }, [open, items, alreadyRefunded]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]);

  // ── Derived calculations ─────────────────────────────────────────────────
  const isFullRefund = quantities.every((qty, idx) => {
    const max = maxByIdx[idx];
    return max === 0 || qty >= max;
  });

  // Pre-coupon item amounts (used for commission clawback ratios)
  const returnedTotal = isFullRefund
    ? items.reduce((s, item, idx) => s + item.lineTotal * (maxByIdx[idx] / item.quantity), 0)
    : quantities.reduce((sum, qty, idx) => {
        if (qty <= 0) return sum;
        const item = items[idx];
        return sum + item.lineTotal * (qty / item.quantity);
      }, 0);

  const itemsSubtotal = items.reduce((s, item) => s + item.lineTotal, 0);
  const eventRatio    = isFullRefund ? 1.0 : (itemsSubtotal > 0 ? Math.min(1.0, returnedTotal / itemsSubtotal) : 0);

  // Coupon-adjusted amount: what the customer actually paid for products
  // total = post-coupon grand total (includes shipping); subtract shipping to get product-only amount
  const actualProductsPaid  = Math.max(0, total - (shippingRate ?? 0));
  const couponFactor        = itemsSubtotal > 0 ? Math.min(1, actualProductsPaid / itemsSubtotal) : 1;
  const hasCoupon           = couponFactor < 0.9999;
  // Amount to auto-fill: scale pre-coupon returnedTotal by the coupon factor
  const adjustedReturnedTotal = isFullRefund ? actualProductsPaid : returnedTotal * couponFactor;

  const remainingSalesRepCommission  = Math.max(0, salesRepCommissionAmount  - existingSalesRepClawback);
  const remainingPhysicianCommission = Math.max(0, physicianCommissionAmount - existingPhysicianClawback);

  const salesRepClawback  = isFullRefund
    ? remainingSalesRepCommission
    : Math.min(remainingSalesRepCommission, salesRepCommissionAmount * eventRatio);
  const physicianClawback = isFullRefund
    ? remainingPhysicianCommission
    : Math.min(remainingPhysicianCommission, physicianCommissionAmount * eventRatio);

  const hasSelection = quantities.some(q => q > 0);

  // Auto-fill customer refund amount using the coupon-adjusted amount
  useEffect(() => {
    const base = adjustedReturnedTotal + (includeShipping ? (shippingRate ?? 0) : 0);
    setCustAmount(base.toFixed(2));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustedReturnedTotal, includeShipping]);

  function setAllFull()  { setQtys(items.map((_, idx) => maxByIdx[idx])); }
  function setAllZero()  { setQtys(items.map(() => 0)); }

  function setQty(idx: number, val: number) {
    const max = maxByIdx[idx];
    setQtys(prev => {
      const next = [...prev];
      next[idx]  = Math.min(max, Math.max(0, val));
      return next;
    });
  }

  function handleConfirm() {
    if (!hasSelection) return;
    start(async () => {
      const lines: RefundLineItem[] | null = isFullRefund
        ? null
        : quantities
            .map((qty, idx) => ({ index: idx, returnedQty: qty }))
            .filter(l => l.returnedQty > 0);

      const amt = parseFloat(custAmount);
      const customerRefundPayload: CustomerRefundPayload | undefined =
        !isNaN(amt) && amt > 0 ? { method: custMethod, amount: amt } : undefined;

      const res = await processReturn(orderId, lines, reason, customerRefundPayload);
      if (res?.success) {
        toast.success(res.message ?? "Refund processed.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res?.message ?? "Failed to process refund.");
      }
    });
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
        Process Refund
      </button>

      {/* Modal */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
        >
          <div className="flex min-h-full items-center justify-center p-4 pt-[130px] pb-8">
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
            style={{ maxHeight: "calc(100vh - 150px)" }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-bold text-gray-800">Process Refund</h3>
              <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-0.5">
                <span className="font-mono font-semibold text-gray-600">#{orderNumber}</span>
                {salesRepName  && <span>Rep: <span className="text-gray-600 font-medium">{salesRepName}</span></span>}
                {physicianName && <span>Dr: <span className="text-gray-600 font-medium">{physicianName}</span></span>}
                <span>Order Total: <span className="text-gray-800 font-bold">{fmt(total)}</span></span>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex-1 overflow-hidden min-h-0 grid grid-cols-[1fr_380px]">

              {/* ── LEFT: Items ───────────────────────────────────────── */}
              <div className="overflow-y-auto px-6 py-4 space-y-4 border-r border-gray-100">
                {/* Quick-select */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={setAllFull}
                    className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Full Refund
                  </button>
                  <button
                    type="button"
                    onClick={setAllZero}
                    className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Clear All
                  </button>
                  {isFullRefund && hasSelection && (
                    <span className="ml-auto text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      Full Refund — order will be marked Refunded
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-gray-50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Ordered</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Refund Qty</span>
                  </div>
                  {items.map((item, idx) => {
                    const qty       = quantities[idx] ?? 0;
                    const max       = maxByIdx[idx];
                    const prevQty   = alreadyRefunded[idx] ?? 0;
                    const active    = qty > 0;
                    const exhausted = max === 0;
                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 transition-colors ${
                          exhausted ? "bg-gray-50/80 opacity-60" : active ? "bg-orange-50/40" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {item.variantSize && <span>{item.variantSize} · </span>}
                            {fmt(item.unitPrice)} ea.
                            {prevQty > 0 && <span className="ml-1.5 text-amber-500">prev. refunded: {prevQty}</span>}
                            {qty > 0 && !exhausted && (
                              <span className="ml-1.5 text-orange-500 font-medium">
                                Refund: {fmt(item.lineTotal * qty / item.quantity)}
                              </span>
                            )}
                            {exhausted && <span className="ml-1.5 text-gray-400">Already fully refunded</span>}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 font-medium w-10 text-center">{item.quantity}</span>
                        <div className="flex items-center gap-1">
                          {exhausted ? (
                            <span className="text-[10px] text-gray-300 font-medium w-[84px] text-center">—</span>
                          ) : (
                            <>
                              <button type="button" onClick={() => setQty(idx, qty - 1)} disabled={qty <= 0}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors border border-gray-200 text-sm font-bold">−</button>
                              <input
                                type="number" min={0} max={max} value={qty}
                                onChange={e => setQty(idx, parseInt(e.target.value) || 0)}
                                className="w-10 text-center text-xs font-semibold border border-gray-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <button type="button" onClick={() => setQty(idx, qty + 1)} disabled={qty >= max}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors border border-gray-200 text-sm font-bold">+</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── RIGHT: Preview + Customer Refund + Reason ─────────── */}
              <div className="overflow-y-auto px-5 py-4 space-y-4 bg-gray-50/30">

                {/* Refund Preview */}
                <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Refund Preview</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Refund amount</span>
                    <span className="text-sm font-bold text-gray-800">{fmt(adjustedReturnedTotal)}</span>
                  </div>
                  {hasCoupon && (
                    <div className="flex items-center gap-1.5 text-[11px] text-violet-600 bg-violet-50 rounded-lg px-2.5 py-1.5">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Coupon applied — refunding actual amount paid, not pre-coupon total
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 space-y-2.5">
                    {/* Sales rep clawback */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          Rep Clawback
                          {salesRepName && <span className="font-normal text-gray-400 ml-1">({salesRepName})</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {fmt(remainingSalesRepCommission)} × {(eventRatio * 100).toFixed(1)}%
                          {!commissionPaid && <span className="text-amber-500 ml-1">· not paid</span>}
                          {commissionPaid && salesRepWalletBalance != null && (
                            <span className="ml-1">· {fmtBalance(salesRepWalletBalance)} → {fmtBalance(salesRepWalletBalance - salesRepClawback)}</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${commissionPaid ? "text-red-500" : "text-gray-300 line-through"}`}>
                        −{fmt(salesRepClawback)}
                      </span>
                    </div>
                    {/* Physician clawback */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          Doctor Clawback
                          {physicianName && <span className="font-normal text-gray-400 ml-1">({physicianName})</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {fmt(remainingPhysicianCommission)} × {(eventRatio * 100).toFixed(1)}%
                          {!commissionPaid && <span className="text-amber-500 ml-1">· not paid</span>}
                          {commissionPaid && physicianWalletBalance != null && (
                            <span className="ml-1">· {fmtBalance(physicianWalletBalance)} → {fmtBalance(physicianWalletBalance - physicianClawback)}</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${commissionPaid ? "text-red-500" : "text-gray-300 line-through"}`}>
                        −{fmt(physicianClawback)}
                      </span>
                    </div>
                  </div>
                  {commissionPaid && (
                    <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
                      <svg className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-[11px] text-orange-600">Commission was already paid — wallets will be debited.</p>
                    </div>
                  )}
                </div>

                {/* Customer Payment Refund */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer Payment Refund</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="flex items-center gap-2">
                      {(["manual", ...(canStripe ? (["stripe"] as const) : [])] as const satisfies readonly ("manual"|"stripe")[]).map((m) => {
                        const labels: Record<"manual"|"stripe", string> = { manual: "Manual", stripe: "Via Stripe" };
                        const active = custMethod === m;
                        return (
                          <button key={m} type="button" onClick={() => setCustMethod(m)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                              active
                                ? m === "stripe" ? "bg-indigo-600 text-white border-indigo-600" : "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {labels[m]}
                          </button>
                        );
                      })}
                    </div>
                    {/* Shipping checkbox */}
                    {shippingRate > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={includeShipping}
                          onChange={(e) => setIncludeShipping(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-gray-300 accent-orange-500"
                        />
                        <span className="text-xs text-gray-600">
                          Include shipping fee <span className="font-semibold text-gray-800">({fmt(shippingRate)})</span>
                        </span>
                      </label>
                    )}
                    {/* Amount */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 shrink-0 w-14">Amount</label>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                        <input
                          type="number" min={0.01} step={0.01}
                          value={custAmount}
                          onChange={e => setCustAmount(e.target.value)}
                          placeholder={returnedTotal.toFixed(2)}
                          className="w-full pl-6 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                        />
                      </div>
                    </div>
                    {custMethod === "stripe" && (
                      <div className="flex items-start gap-2 text-[11px] text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Stripe will send the refund to the original card used for payment.
                      </div>
                    )}
                    {custMethod === "manual" && (
                      <div className="flex items-start gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Record-only — ensure the customer receives payment outside the system.
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Refund Reason <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Damaged goods, wrong item, customer request…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-3 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || !hasSelection}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl transition-colors"
              >
                {isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                }
                {isPending ? "Processing…" : "Confirm Refund"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
