"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/cart-context";
import { formatCurrency } from "@/lib/utils/currency";

export function OrderBehalfBar({
  physicianId,
  physicianName,
  physicianEmail,
}: {
  physicianId:    string;
  physicianName:  string;
  physicianEmail: string;
}) {
  const { totalItems, totalPrice } = useCart();

  return (
    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Ordering on behalf of {physicianName}
          </p>
          <p className="text-xs text-amber-600">{physicianEmail}</p>
        </div>
      </div>

      <Link
        href={`/admin/order-behalf/${physicianId}/cart`}
        className="relative inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        View Cart
        {totalItems > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-white text-amber-700 rounded-full">
            {totalItems}
          </span>
        )}
        {totalItems > 0 && (
          <span className="hidden sm:inline text-amber-200 font-normal">
            · {formatCurrency(totalPrice)}
          </span>
        )}
      </Link>
    </div>
  );
}
