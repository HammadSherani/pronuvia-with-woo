"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { createWithdrawRequest } from "@/actions/sales-rep/withdraw-request";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function WithdrawModal({
  balance,
  hasPending,
  bankName,
  bankAccountNumber,
  bankAccountName,
  onClose,
}: {
  balance:           number;
  hasPending:        boolean;
  bankName?:         string | null;
  bankAccountNumber?:string | null;
  bankAccountName?:  string | null;
  onClose:           () => void;
}) {
  const [state, action, pending] = useActionState(createWithdrawRequest, undefined);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on success
  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasBankDetails = bankName || bankAccountNumber;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">Request Withdrawal</h2>
            <p className="text-xs text-gray-400 mt-0.5">Funds will be sent to your linked bank account</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Balance pill */}
          <div className="flex items-center justify-between bg-gray-900/8 border border-gray-900/25 rounded-xl px-4 py-3">
            <span className="text-xs font-medium text-gray-500">Available Balance</span>
            <span className="text-lg font-black text-[#3DBFA4]">{fmt(balance)}</span>
          </div>

          {/* Bank destination */}
          {hasBankDetails ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-900/15 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#5BB8D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">Sending to</p>
                {bankAccountName && <p className="text-xs text-gray-600 mt-0.5">{bankAccountName}</p>}
                {bankName        && <p className="text-xs text-gray-400">{bankName}</p>}
                {bankAccountNumber && (
                  <p className="text-xs text-gray-400 font-mono tracking-wider">
                    ••••&nbsp;{bankAccountNumber.slice(-4)}
                  </p>
                )}
              </div>
              <Link
                href="/sales/account"
                onClick={onClose}
                className="shrink-0 text-[11px] font-semibold text-[#3DBFA4] hover:text-[#35a993] flex items-center gap-1 mt-0.5 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs text-amber-700">
                  No bank account linked. Please add your bank details before requesting a withdrawal.
                </p>
              </div>
              <Link
                href="/sales/account"
                onClick={onClose}
                className="shrink-0 text-[11px] font-semibold text-amber-700 underline hover:text-amber-900 transition-colors whitespace-nowrap"
              >
                Add now
              </Link>
            </div>
          )}

          {/* Pending lock */}
          {hasPending ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs text-amber-700">
                You have a pending withdrawal request. New requests are blocked until the admin processes the current one.
              </p>
            </div>
          ) : balance < 10 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 text-center">Minimum withdrawal is $10.00. Your current balance is insufficient.</p>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Withdrawal Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                  <input
                    type="number"
                    name="amount"
                    min={10}
                    max={balance}
                    step={0.01}
                    required
                    placeholder="0.00"
                    className="w-full pl-8 pr-20 py-3 text-sm font-medium border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#3DBFA4] hover:text-[#35a993] px-2 py-1 rounded-lg hover:bg-gray-900/8 transition-colors"
                    onClick={(e) => {
                      const input = (e.currentTarget.closest("div")!.querySelector("input") as HTMLInputElement);
                      input.value = String(balance);
                      input.dispatchEvent(new Event("input", { bubbles: true }));
                    }}
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 flex justify-between">
                  <span>Minimum: $10.00</span>
                  <span>Maximum: {fmt(balance)}</span>
                </p>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Note <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Any message for the admin…"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 resize-none transition-colors"
                />
              </div>

              {/* Server error */}
              {state && !state.success && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600">{state.message}</p>
                </div>
              )}

              {/* Success */}
              {state?.success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-emerald-700 font-medium">{state.message}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !hasBankDetails}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pending ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {pending ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
