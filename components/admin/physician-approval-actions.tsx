"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { approvePhysician, rejectPhysician } from "@/actions/admin/manage-approvals";

export function PhysicianApprovalActions({
  physicianId,
  physicianName,
}: {
  physicianId:        string;
  physicianName:      string;
  existingCommission?: number;
  salesRep?:          { firstName: string; lastName: string } | null;
}) {
  const router                          = useRouter();
  const [isPending,   startTransition]  = useTransition();
  const [showApprove, setShowApprove]   = useState(false);
  const [showReject,  setShowReject]    = useState(false);

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approvePhysician(physicianId);
      if (res?.success) {
        toast.success(res.message ?? "Approved");
        setShowApprove(false);
        router.refresh();
      } else {
        toast.error(res?.message ?? "Failed to approve");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectPhysician(physicianId);
      if (res?.success) {
        toast.success("Physician rejected");
        setShowReject(false);
        router.refresh();
      } else {
        toast.error(res?.message ?? "Failed to reject");
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowApprove(true)}
          disabled={isPending}
          title="Approve"
          className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setShowReject(true)}
          disabled={isPending}
          title="Reject"
          className="w-7 h-7 flex items-center justify-center rounded-md bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Approve confirm modal */}
      {showApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Approve this physician?</p>
                <p className="text-xs text-gray-500 mt-0.5">{physicianName} will be approved and sent a setup email.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isPending ? "Approving…" : "Yes, Approve"}
              </button>
              <button
                onClick={() => setShowApprove(false)}
                disabled={isPending}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Reject this physician?</p>
                <p className="text-xs text-gray-500 mt-0.5">{physicianName} will be marked as rejected.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={isPending}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isPending ? "Rejecting…" : "Yes, Reject"}
              </button>
              <button
                onClick={() => setShowReject(false)}
                disabled={isPending}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
