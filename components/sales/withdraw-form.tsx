"use client";

import { useActionState, useEffect } from "react";
import toast from "react-hot-toast";
import { createWithdrawRequest } from "@/actions/sales-rep/withdraw-request";

export function WithdrawForm({
  balance,
  hasPending,
}: {
  balance:    number;
  hasPending: boolean;
}) {
  const [state, action, pending] = useActionState(createWithdrawRequest, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.success) toast.success(state.message ?? "Request submitted.");
    else               toast.error(state.message   ?? "Something went wrong.");
  }, [state]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-700 mb-3">Request Withdrawal</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

        {/* Balance hint */}
        <div className="flex items-center justify-between bg-gray-900/5 border border-gray-900/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-gray-500 font-medium">Available Balance</p>
          <p className="text-base font-bold text-[#3DBFA4]">{fmt(balance)}</p>
        </div>

        {hasPending ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-700">
              You have a pending withdrawal request. New requests are blocked until it is processed by the admin.
            </p>
          </div>
        ) : balance < 10 ? (
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-500">
              Minimum withdrawal is $10.00. Your current balance is insufficient.
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Amount (min $10)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">$</span>
                <input
                  type="number"
                  name="amount"
                  min={10}
                  max={balance}
                  step={0.01}
                  required
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Maximum: {fmt(balance)}
              </p>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Note <span className="text-gray-300 font-normal">(optional)</span>
              </label>
              <textarea
                name="note"
                rows={2}
                placeholder="Bank account details or any message for admin…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 resize-none transition-colors"
              />
            </div>

            {/* Error from state */}
            {state && !state.success && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {pending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Submit Withdrawal Request
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
