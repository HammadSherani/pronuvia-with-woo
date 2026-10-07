"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/cart-context";
import { formatCurrency } from "@/lib/utils/currency";

export function BehalfCartClient({
  physicianId,
  physicianName,
  physicianEmail,
}: {
  physicianId:    string;
  physicianName:  string;
  physicianEmail: string;
}) {
  const { items, removeItem, updateQty, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="max-w-2xl mx-auto text-center py-24">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Cart is empty</h1>
          <p className="text-sm text-gray-500 mb-6">Add products from the shop first.</p>
          <Link href={`/admin/order-behalf/${physicianId}/shop`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors">
            Browse Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Order Cart</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href={`/admin/order-behalf/${physicianId}/shop`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.cartId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                {item.productImage
                  ? <img src={item.productImage} alt={item.productTitle} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{item.productTitle}</p>
                {item.variantSize && <p className="text-xs text-gray-500 mt-0.5">Size: {item.variantSize}</p>}
                {item.variantSku  && <p className="text-xs text-gray-400">SKU: {item.variantSku}</p>}
                <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(item.unitPrice)}</p>
              </div>

              <div className="flex flex-col items-end justify-between shrink-0 gap-3">
                <button type="button" onClick={() => removeItem(item.cartId)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button type="button"
                      onClick={() => item.quantity === 1 ? removeItem(item.cartId) : updateQty(item.cartId, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-base leading-none">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-800">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.cartId, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-base leading-none">+</button>
                  </div>
                  <p className="text-sm font-bold text-gray-900 w-16 text-right">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
            <h2 className="text-sm font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">Order Summary</h2>
            <div className="space-y-2 mb-4">
              {items.map((item) => (
                <div key={item.cartId} className="flex justify-between text-xs text-gray-500">
                  <span className="truncate pr-2 max-w-[160px]">
                    {item.productTitle}{item.variantSize ? ` (${item.variantSize})` : ""} × {item.quantity}
                  </span>
                  <span className="shrink-0 font-medium text-gray-700">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-100 mb-5">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(totalPrice)}</span>
            </div>
            <Link href={`/admin/order-behalf/${physicianId}/checkout`}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors shadow-sm">
              Proceed to Checkout
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
