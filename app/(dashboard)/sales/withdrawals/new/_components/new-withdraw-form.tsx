"use client";

import { useActionState } from "react";
import { createWithdrawRequest } from "@/actions/sales-rep/withdrawals";

export function NewWithdrawForm({ maxAmount }: { maxAmount: number }) {
  const [state, action, pending] = useActionState(createWithdrawRequest, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.message && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {state.message}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Amount (max: {maxAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })})
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
          <input
            type="number" name="amount" step="0.01" min="1" max={maxAmount}
            placeholder="0.00"
            className={`w-full pl-8 pr-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
              state?.errors?.amount
                ? "border-red-300 bg-red-50"
                : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
            }`}
          />
        </div>
        {state?.errors?.amount && (
          <p className="text-xs text-red-500 mt-1">{state.errors.amount[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Note <span className="text-gray-300">(optional)</span>
        </label>
        <textarea
          name="note" rows={3} placeholder="Any notes for the admin…"
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 bg-gray-50 rounded-xl outline-none resize-none focus:border-gray-900 focus:bg-white transition-colors"
        />
      </div>

      <button
        type="submit" disabled={pending || maxAmount <= 0}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {pending ? "Submitting…" : "Submit Withdrawal Request"}
      </button>

      <p className="text-xs text-center text-gray-400">
        Requests are typically processed within 2–5 business days.
      </p>
    </form>
  );
}
