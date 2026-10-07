"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateWithdrawRequest } from "@/actions/admin/manage-withdrawals";

interface Props {
  requestId: string;
  amount:    number;
  userName:  string;
  userEmail: string;
  period:    string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function WithdrawalDetailActions({ requestId, amount, userName, userEmail, period }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [note,  setNote]  = useState("");
  const [busy, start]     = useTransition();

  const handle = (action: "APPROVED" | "REJECTED") => {
    start(async () => {
      const res = await updateWithdrawRequest(requestId, action, note);
      if (res?.success) {
        toast.success(action === "APPROVED"
          ? `Approved ${fmt(amount)} — email sent to ${userEmail}`
          : "Request rejected.");
        setModal(null);
        router.push("/admin/withdrawals");
      } else {
        toast.error(res?.message ?? "Something went wrong.");
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModal("APPROVED")}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Approve
        </button>
        <button
          type="button"
          onClick={() => setModal("REJECTED")}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Reject
        </button>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {modal === "APPROVED" ? "Approve Payout" : "Reject Request"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {modal === "APPROVED"
                ? `Approve ${fmt(amount)} commission payout for ${userName} (${period})?`
                : `Reject the ${fmt(amount)} commission request for ${userName}?`}
            </p>
            {modal === "APPROVED" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 text-xs text-emerald-700 font-medium">
                Commission balance will be deducted and a PDF statement will be emailed to {userEmail}
              </div>
            )}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Admin Note <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={modal === "APPROVED" ? "e.g. Paid via ACH on Aug 5" : "e.g. Insufficient balance"}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setModal(null); setNote(""); }}
                disabled={busy}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handle(modal)}
                disabled={busy}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-colors ${
                  modal === "APPROVED" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {busy
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : modal === "APPROVED" ? "Approve & Send" : "Reject"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
