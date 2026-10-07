"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function OrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminOrderDetail] runtime error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <div className="bg-white rounded-xl border border-red-100 shadow-sm p-8">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Failed to load order</h2>
        <p className="text-sm text-red-500 font-mono mb-1">{error.message}</p>
        {error.digest && <p className="text-xs text-gray-400 mb-6">Digest: {error.digest}</p>}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Try again
          </button>
          <Link href="/admin/orders" className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
