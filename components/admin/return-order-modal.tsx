"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { getOrderByNumber, processReturn, type RefundLineItem } from "@/actions/admin/manage-orders";

type OrderData = NonNullable<Awaited<ReturnType<typeof getOrderByNumber>>>;
type OrderItem = { title: string; variantSize: string; sku: string; quantity: number; unitPrice: number; lineTotal: number };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ─── Shared modal shell ───────────────────────────────────────────────────────
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: "min(90vh, 700px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Step 1 — Lookup ──────────────────────────────────────────────────────────
function LookupStep({ onFound, initialOrderNumber }: { onFound: (o: OrderData) => void; initialOrderNumber?: string }) {
  const [num, setNum]      = useState(initialOrderNumber ?? "");
  const [err, setErr]      = useState("");
  const [isPending, start] = useTransition();
  const inputRef           = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const lookup = () => {
    if (!num.trim()) { setErr("Enter an order number."); return; }
    setErr("");
    start(async () => {
      const order = await getOrderByNumber(num.trim());
      if (!order)                      { setErr(`Order "${num.trim()}" not found.`); return; }
      if (order.returnedAt)            { setErr("This order has already been returned."); return; }
      if (order.status === "CANCELLED"){ setErr("Cancelled orders cannot be returned."); return; }
      onFound(order);
    });
  };

  return (
    <div className="p-6 shrink-0">
      <h3 className="text-base font-bold text-gray-800 mb-1">Process Refund</h3>
      <p className="text-sm text-gray-500 mb-5">Enter the order number to begin a refund.</p>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order Number</label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={num}
          onChange={(e) => setNum(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") lookup(); }}
          placeholder="ORD-20240101-XXXXXX"
          className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 font-mono uppercase transition-colors"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={isPending}
          className="px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-2 shrink-0"
        >
          {isPending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
          }
          Look Up
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-500 font-medium">{err}</p>}
    </div>
  );
}

// ─── Step 2 — Select items + confirm ─────────────────────────────────────────
function SelectStep({ order, onBack, onDone }: { order: OrderData; onBack: () => void; onDone: () => void }) {
  const items                        = order.items as unknown as OrderItem[];
  const [fullReturn,  setFullReturn]  = useState(true);
  const [selected,    setSelected]    = useState<Set<number>>(new Set(items.map((_, i) => i)));
  const [reason,      setReason]      = useState("");
  const [isPending,   start]          = useTransition();

  const toggleItem = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleFull = (v: boolean) => {
    setFullReturn(v);
    if (v) setSelected(new Set(items.map((_, i) => i)));
  };

  const returnedTotal     = fullReturn
    ? order.total
    : [...selected].reduce((s, idx) => s + (items[idx]?.lineTotal ?? 0), 0);
  const ratio             = order.total > 0 ? returnedTotal / order.total : 0;
  const salesRepClawback  = order.salesRepCommissionAmount  * ratio;
  const physicianClawback = order.physicianCommissionAmount * ratio;
  const commissionPaid    = order.commissionPaid;
  const canConfirm        = fullReturn || selected.size > 0;

  const confirm = () => {
    if (!canConfirm) return;
    start(async () => {
      const lines: RefundLineItem[] | null = fullReturn
        ? null
        : [...selected].sort((a, b) => a - b).map(idx => ({
            index: idx,
            returnedQty: items[idx]?.quantity ?? 1,
          }));
      const res = await processReturn(order.id, lines, reason);
      if (res?.success) { toast.success(res.message ?? "Refund processed"); onDone(); }
      else              { toast.error(res?.message ?? "Failed to process refund"); }
    });
  };

  return (
    /* Uses flex-col + flex-1/min-h-0 so the scrollable area actually scrolls */
    <div className="flex flex-col flex-1 min-h-0">

      {/* Fixed header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="text-gray-400 hover:text-gray-600 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-800 truncate">
              Refund — <span className="font-mono">{order.orderNumber}</span>
            </h3>
            <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-0.5">
              {order.salesRep && (
                <span>Rep: <span className="text-gray-600 font-medium">{order.salesRep.name}</span></span>
              )}
              {order.physician && (
                <span>Dr: <span className="text-gray-600 font-medium">{order.physician.firstName} {order.physician.lastName}</span></span>
              )}
              <span>Total: <span className="text-gray-800 font-bold">{fmt(order.total)}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">

        {/* Full return toggle */}
        <label className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl cursor-pointer select-none">
          <input
            type="checkbox"
            checked={fullReturn}
            onChange={(e) => toggleFull(e.target.checked)}
            className="w-4 h-4 accent-orange-500 rounded shrink-0"
          />
          <div>
            <p className="text-sm font-bold text-orange-700">Full Invoice Refund</p>
            <p className="text-xs text-orange-500">Refunds all items — order marked as Refunded</p>
          </div>
        </label>

        {/* Items */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {fullReturn ? "Items (all selected)" : "Select items to refund"}
          </p>
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
            {items.map((item, idx) => {
              const isChecked = fullReturn || selected.has(idx);
              return (
                <label
                  key={idx}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                    isChecked ? "bg-orange-50/50" : "hover:bg-gray-50/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={fullReturn}
                    onChange={() => toggleItem(idx)}
                    className="w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-400">
                      {item.variantSize && <span>{item.variantSize} · </span>}
                      Qty {item.quantity} · {fmt(item.unitPrice)} each
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${isChecked ? "text-orange-600" : "text-gray-300"}`}>
                    {fmt(item.lineTotal)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Clawback preview */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clawback Preview</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Returned value</span>
            <span className="text-sm font-bold text-gray-800">{fmt(returnedTotal)}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">Medical Rep Commission</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {fmt(order.salesRepCommissionAmount)} × {(ratio * 100).toFixed(1)}%
                  {!commissionPaid && <span className="text-amber-500 ml-1">· not yet paid</span>}
                </p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${commissionPaid ? "text-red-500" : "text-gray-300 line-through"}`}>
                −{fmt(salesRepClawback)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">Doctor Commission</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {fmt(order.physicianCommissionAmount)} × {(ratio * 100).toFixed(1)}%
                  <span className="ml-1">· tracked only</span>
                </p>
              </div>
              <span className="text-sm font-bold shrink-0 text-gray-400">
                −{fmt(physicianClawback)}
              </span>
            </div>
          </div>
          {commissionPaid && (
            <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
              <svg className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-orange-600">
                Commission was already paid.{" "}
                <span className="font-bold">{fmt(salesRepClawback)}</span> will be deducted from{" "}
                {order.salesRep?.name ?? "the sales rep"}&apos;s wallet
                {order.salesRep?.walletBalance != null && (
                  <span className="text-orange-400"> (current: {fmt(order.salesRep.walletBalance)})</span>
                )}.
              </p>
            </div>
          )}
        </div>

        {/* Reason textarea */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Return Reason <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged goods, wrong item, customer request…"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none transition-colors"
          />
        </div>
      </div>

      {/* Fixed footer */}
      <div className="px-6 pb-5 pt-3 border-t border-gray-100 shrink-0 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={isPending || !canConfirm}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl transition-colors"
        >
          {isPending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
          }
          Confirm Refund
        </button>
      </div>
    </div>
  );
}

// ─── Standalone header button ─────────────────────────────────────────────────
export function ReturnOrderModal({ initialOrderNumber }: { initialOrderNumber?: string }) {
  const [open,  setOpen]  = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);

  const close = () => { setOpen(false); setOrder(null); };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOrder(null); setOpen(true); }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
        Refund Order
      </button>

      {open && (
        <ModalShell onClose={close}>
          {!order
            ? <LookupStep onFound={setOrder} initialOrderNumber={initialOrderNumber} />
            : <SelectStep order={order} onBack={() => setOrder(null)} onDone={close} />
          }
        </ModalShell>
      )}
    </>
  );
}

// ─── Per-row return button ────────────────────────────────────────────────────
export function ReturnRowButton({ orderId, orderNumber, alreadyReturned }: {
  orderId:         string;
  orderNumber:     string;
  alreadyReturned: boolean;
}) {
  const [open,    setOpen]  = useState(false);
  const [order,   setOrder] = useState<OrderData | null>(null);
  const [loading, start]    = useTransition();

  void orderId;

  const close = () => { setOpen(false); setOrder(null); };

  const openModal = () => {
    setOpen(true);
    start(async () => {
      const data = await getOrderByNumber(orderNumber);
      if (data) setOrder(data);
    });
  };

  if (alreadyReturned) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-500 border border-orange-200 rounded-lg text-xs font-semibold">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
        Returned
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading
          ? <span className="w-3 h-3 border border-orange-300 border-t-orange-500 rounded-full animate-spin" />
          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
        }
        Return
      </button>

      {open && (
        <ModalShell onClose={close}>
          {!order
            ? <div className="flex items-center justify-center py-16">
                <span className="w-6 h-6 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            : <SelectStep order={order} onBack={close} onDone={close} />
          }
        </ModalShell>
      )}
    </>
  );
}
