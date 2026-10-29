"use client";

import { useState } from "react";
import type { useCheckoutQuote } from "@/lib/checkout/use-checkout-quote";
import type { AddressData } from "@/components/shared/address-fields";
import { formatCurrency } from "@/lib/utils/currency";

type Item = {
  cartId:       string;
  productTitle: string;
  productImage: string | null;
  variantSize:  string;
  unitPrice:    number;
  quantity:     number;
};

type Props = {
  items:  Item[];
  // The checkout's useCheckoutQuote(): shipping options, coupon, totals
  quote:  ReturnType<typeof useCheckoutQuote>;
  // The address the order ships to (its rates are the ones shown)
  shipTo: AddressData;
};

/**
 * The checkout's "Your order" box, as on the WooCommerce checkout: the items
 * (picture, name, quantity, price), subtotal, the shipping method to pick,
 * coupon, discount / tax and the total.
 */
export function CheckoutOrderSummary({ items, quote, shipTo }: Props) {
  const {
    options: shippingOptions, selected: selectedShipping, setSelected: setSelectedShipping,
    loading: loadingShipping, error: shippingError, retry: retryShipping,
    totals, coupon: appliedCoupon, couponError, couponPending, applyCoupon, removeCoupon,
  } = quote;
  const [couponInput, setCouponInput] = useState("");

  const subtotal = totals?.subtotal ?? parseFloat(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2));

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) return;
    applyCoupon(couponInput);
    setCouponInput("");
  };

  return (
    <div className="border border-gray-200 rounded overflow-hidden">

      {/* Items */}
      <div className="px-4 py-4 space-y-4 border-b border-gray-200">
        {items.map((item) => (
          <div key={item.cartId} className="flex gap-3 items-start">
            <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
              {item.productImage ? (
                <img src={item.productImage} alt={item.productTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 font-medium">{item.productTitle}</p>
              {item.variantSize && <p className="text-xs text-gray-400">Size: {item.variantSize}</p>}
              <p className="text-xs text-gray-500 mt-0.5">Quantity: {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-gray-800 shrink-0">
              {formatCurrency(item.unitPrice * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      {/* Subtotal */}
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between text-sm text-gray-700">
        <span className="font-medium">Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>

      {/* Shipping method */}
      <div className="px-4 py-3 border-b border-gray-200 text-sm">
        <p className="font-medium text-gray-700 mb-2">Shipping</p>
        {!shipTo.country ? (
          <p className="italic text-xs text-gray-400">Enter address first</p>
        ) : loadingShipping ? (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="w-4 h-4 border-2 border-gray-200 border-t-[#3DBFA4] rounded-full animate-spin" />
            Loading shipping options…
          </div>
        ) : shippingError ? (
          <div className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 rounded px-3 py-2 text-red-700">
            <span>{shippingError}</span>
            <button type="button" onClick={retryShipping} className="shrink-0 font-semibold underline hover:no-underline">
              Try again
            </button>
          </div>
        ) : shippingOptions.length === 0 ? (
          <div className="border border-amber-200 bg-amber-50 rounded px-3 py-2 text-amber-700">
            No shipping available to this address{shipTo.countryName ? ` in ${shipTo.countryName}` : ""}. Please contact us.
          </div>
        ) : (
          <div className="space-y-1.5">
            {shippingOptions.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="shippingMethod"
                  checked={selectedShipping?.id === opt.id}
                  onChange={() => setSelectedShipping(opt)}
                  className="accent-gray-900"
                />
                <span className="flex-1 text-gray-800">{opt.label}</span>
                <span className="font-semibold text-gray-800">
                  {opt.cost === 0 ? <span className="text-emerald-600">Free</span> : formatCurrency(opt.cost)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Coupon input */}
      <div className="px-4 py-3 border-b border-gray-200">
        {appliedCoupon ? (
          <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <span className="text-xs font-bold text-emerald-700 font-mono">{appliedCoupon.code}</span>
                <span className="text-xs text-emerald-600 ml-1">— −{formatCurrency(appliedCoupon.discount)}</span>
              </div>
            </div>
            <button type="button" onClick={removeCoupon}
              className="text-xs text-emerald-600 hover:text-emerald-800 underline shrink-0">
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono placeholder:font-sans placeholder:text-gray-400"
              />
              <button type="button" onClick={handleApplyCoupon} disabled={couponPending || !couponInput.trim()}
                className="px-3 py-2 text-xs font-bold text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 rounded transition-colors whitespace-nowrap">
                {couponPending ? "…" : "Apply"}
              </button>
            </div>
            {couponError && <p className="text-xs text-red-600">{couponError}</p>}
          </div>
        )}
      </div>

      {/* Discount / tax */}
      {(appliedCoupon || !!totals?.tax) && (
        <div className="px-4 py-3 space-y-2 border-b border-gray-200 text-sm text-gray-600">
          {appliedCoupon && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Coupon ({appliedCoupon.code})</span>
              <span>−{formatCurrency(appliedCoupon.discount)}</span>
            </div>
          )}
          {!!totals?.tax && (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
          )}
        </div>
      )}

      {/* Total */}
      <div className="px-4 py-4">
        <div className="flex justify-between text-base font-bold text-gray-900">
          <span>Total</span>
          {totals ? (
            <span>{formatCurrency(totals.total)}</span>
          ) : (
            <span className="text-gray-400 italic text-xs font-normal">Calculating…</span>
          )}
        </div>
      </div>
    </div>
  );
}
