"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { updatePhysicianWithdrawRequest, deletePhysicianWithdrawRequest } from "@/actions/admin/manage-physician-withdrawals";

export function PhysicianWithdrawalActions({ requestId }: { requestId: string }) {
  const [isPending, startTransition]      = useTransition();
  const [adminNote, setAdminNote]          = useState("");
  const [open,      setOpen]               = useState(false);
  const [pendingAction, setPendingAction]  = useState<"APPROVED" | "REJECTED" | null>(null);
  const [confirmDelete, setConfirmDelete]  = useState(false);

  const handle = (action: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      const res = await updatePhysicianWithdrawRequest(requestId, action, adminNote);
      if (res?.success) {
        toast.success(res.message ?? "Done");
        setOpen(false);
        setAdminNote("");
      } else {
        toast.error(res?.message ?? "Failed");
      }
    });
  };

  const confirm = (action: "APPROVED" | "REJECTED") => {
    setPendingAction(action);
    setOpen(true);
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deletePhysicianWithdrawRequest(requestId);
      if (res?.success) { toast.success(res.message ?? "Removed"); setConfirmDelete(false); }
      else              { toast.error(res?.message ?? "Failed"); }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => confirm("APPROVED")} disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Approve
        </button>
        <button type="button" onClick={() => confirm("REJECTED")} disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Reject
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={isPending}
          title="Delete request"
          className="inline-flex items-center justify-center w-7 h-7 bg-gray-50 text-gray-400 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">Delete Request</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently remove the pending request. The wallet balance is not affected.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={isPending}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-colors">
                {isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {pendingAction === "APPROVED" ? "Approve Withdrawal" : "Reject Withdrawal"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {pendingAction === "APPROVED"
                ? "The amount will be deducted from the physician's wallet."
                : "The request will be marked as rejected."}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Note for physician <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Reason or message…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 resize-none transition-colors" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setOpen(false); setAdminNote(""); }}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => handle(pendingAction)} disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-colors ${
                  pendingAction === "APPROVED" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                }`}>
                {isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : pendingAction === "APPROVED" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
