"use client";

import { useActionState, useEffect } from "react";
import toast from "react-hot-toast";
import { createOrderBySalesRep } from "@/actions/sales-rep/create-order";
import { formatCurrency } from "@/lib/utils/currency";

type Props = {
  product:     { id: string; title: string; salePrice: number };
  variantSize: string;
  variantSku:  string;
  unitPrice:   number;
  qty:         number;
  onClose:     () => void;
};

export function QuickOrderModal({ product, variantSize, variantSku, unitPrice, qty, onClose }: Props) {
  const [state, action, pending] = useActionState(createOrderBySalesRep, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? "Order placed!");
      onClose();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-bold text-gray-800 mb-1">Confirm Order</h3>
        <p className="text-sm text-gray-500 mb-6">
          {product.title}
          {variantSize ? <span className="text-gray-400"> · {variantSize}</span> : null}
          {" "}× {qty}
          <span className="font-bold text-gray-800 ml-2">{formatCurrency(unitPrice * qty)}</span>
        </p>

        <form action={action} className="space-y-4">
          <input type="hidden" name="productId"   value={product.id} />
          <input type="hidden" name="title"       value={product.title} />
          <input type="hidden" name="variantSize" value={variantSize} />
          <input type="hidden" name="sku"         value={variantSku} />
          <input type="hidden" name="unitPrice"   value={unitPrice} />
          <input type="hidden" name="quantity"    value={qty} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Special instructions…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 resize-none transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border border-gray-200 text-sm font-semibold text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {pending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : null}
              {pending ? "Placing…" : "Confirm Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
