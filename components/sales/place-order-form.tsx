"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createOrderBySalesRep } from "@/actions/sales-rep/create-order";
import { formatCurrency } from "@/lib/utils/currency";

type Variant = {
  size: string;
  sku?: string;
  salePrice?: number;
  stock?: number;
  image?: string;
  isDefault?: boolean;
};

type Physician = {
  id: string;
  firstName: string;
  lastName: string;
  nameOfPractice: string | null;
};

type Props = {
  product: {
    id: string;
    title: string;
    salePrice: number;
    variants: unknown[];
  };
  physicians: Physician[];
};

export function PlaceOrderForm({ product, physicians }: Props) {
  const variants  = product.variants as Variant[];
  const router    = useRouter();

  const [physicianId, setPhysicianId] = useState("");
  const [variantIdx,  setVariantIdx]  = useState(() => {
    const defaultIdx = variants.findIndex((v) => v.isDefault);
    return defaultIdx >= 0 ? defaultIdx : 0;
  });
  const [quantity,    setQuantity]    = useState(1);

  const selectedVariant = variants[variantIdx];
  const unitPrice = selectedVariant?.salePrice ?? product.salePrice;

  const [state, action, pending] = useActionState(createOrderBySalesRep, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? "Order placed!");
      router.push("/sales/orders");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  if (physicians.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
        <svg className="w-8 h-8 text-amber-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm font-medium text-amber-800">No physicians in your downline</p>
        <p className="text-xs text-amber-600 mt-1">Add a physician first before placing orders.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="productId"   value={product.id} />
      <input type="hidden" name="title"       value={product.title} />
      <input type="hidden" name="variantSize" value={selectedVariant?.size ?? ""} />
      <input type="hidden" name="sku"         value={selectedVariant?.sku ?? ""} />
      <input type="hidden" name="unitPrice"   value={unitPrice} />

      {/* Physician */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Physician *</label>
        <select
          name="physicianId"
          value={physicianId}
          onChange={(e) => setPhysicianId(e.target.value)}
          required
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors"
        >
          <option value="">Select a physician…</option>
          {physicians.map((p) => (
            <option key={p.id} value={p.id}>
               {p.firstName} {p.lastName}
              {p.nameOfPractice ? ` — ${p.nameOfPractice}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Variant / size */}
      {variants.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Size / Variant</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setVariantIdx(i)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                  i === variantIdx
                    ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-900/50"
                }`}
              >
                {v.size}
                {v.salePrice !== undefined && (
                  <span className={`ml-1.5 text-xs ${i === variantIdx ? "text-white/80" : "text-gray-400"}`}>
                    {formatCurrency(v.salePrice)}
                  </span>
                )}
              </button>
            ))}
          </div>
          {selectedVariant?.stock !== undefined && (
            <p className="text-xs text-gray-400 mt-1.5">
              {selectedVariant.stock > 0 ? `${selectedVariant.stock} in stock` : "Out of stock"}
            </p>
          )}
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Quantity</label>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3.5 py-2 text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
            >−</button>
            <input
              type="number"
              name="quantity"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 py-2 text-center text-sm font-medium text-gray-800 focus:outline-none border-0"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="px-3.5 py-2 text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
            >+</button>
          </div>
          <span className="text-sm text-gray-500">
            Total: <span className="font-bold text-gray-800">{formatCurrency(unitPrice * quantity)}</span>
          </span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Order Notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          name="notes"
          rows={3}
          placeholder="Any special instructions…"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending || !physicianId}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {pending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Placing Order…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Place Order
          </>
        )}
      </button>
    </form>
  );
}
