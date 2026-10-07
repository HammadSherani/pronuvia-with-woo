"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { shipOrder } from "@/actions/admin/manage-orders";

const CARRIERS = [
  "FedEx Ground",
  "FedEx Express",
  "FedEx Overnight",
  "UPS Ground",
  "UPS 2nd Day Air",
  "UPS Next Day Air",
  "USPS Priority Mail",
  "USPS Priority Mail Express",
  "DHL Express",
  "Other",
];

interface Props {
  orderId:     string;
  orderNumber: string;
  disabled?:   boolean;
}

export function ShipOrderButton({ orderId, orderNumber, disabled }: Props) {
  const [open, setOpen]   = useState(false);
  if (open) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors w-fit"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" />
      </svg>
      Ship
    </button>
  );
}

export function ShipOrderModal({ orderId, orderNumber, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [carrier,           setCarrier]           = useState(CARRIERS[0]);
  const [trackingNumber,    setTrackingNumber]    = useState("");
  const [shippingCost,      setShippingCost]      = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setCarrier(CARRIERS[0]);
    setTrackingNumber("");
    setShippingCost("");
    setEstimatedDelivery("");
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const res = await shipOrder(orderId, {
        carrier,
        trackingNumber,
        shippingCost: shippingCost ? parseFloat(shippingCost) : 0,
        estimatedDelivery,
      });
      if (res?.success) {
        toast.success("Order marked as shipped!");
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res?.message ?? "Failed to ship order.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors w-fit"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" />
        </svg>
        Ship Order
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setOpen(false)} />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800">Ship Order</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{orderNumber}</p>
              </div>
              <button type="button" onClick={() => !pending && setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Carrier */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Shipping Carrier *</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
              >
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tracking number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. 7489234892374892"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-gray-400"
              />
            </div>

            {/* Shipping cost */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Shipping Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-gray-400"
              />
              <p className="text-[11px] text-gray-400">For internal records only — not charged to customer.</p>
            </div>

            {/* Estimated delivery */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Estimated Delivery Date</label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Shipping…
                  </span>
                ) : "Mark as Shipped"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
