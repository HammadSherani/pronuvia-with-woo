"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { approvePhysician, rejectPhysician } from "@/actions/admin/manage-approvals";
import { formatDate } from "@/lib/utils/timezone";

type Physician = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  loginId: string | null;
  nameOfPractice: string | null;
  credential: string | null;
  city: string | null;
  state: string | null;
  salesRepNote: string | null;
  salesRep: { firstName: string; lastName: string; email: string } | null;
  createdAt: Date;
};

export function ApprovalsClient({ physicians }: { physicians: Physician[] }) {
  const [approveTarget, setApproveTarget] = useState<Physician | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<Physician | null>(null);
  const [isPending,     startTransition]  = useTransition();

  function handleApprove() {
    if (!approveTarget) return;
    startTransition(async () => {
      const res = await approvePhysician(approveTarget.id);
      if (res?.success) {
        toast.success(res.message ?? "Approved");
        setApproveTarget(null);
      } else {
        toast.error(res?.message ?? "Failed to approve");
      }
    });
  }

  function handleReject() {
    if (!rejectTarget) return;
    startTransition(async () => {
      const res = await rejectPhysician(rejectTarget.id);
      if (res?.success) {
        toast.success("Physician rejected");
        setRejectTarget(null);
      } else {
        toast.error(res?.message ?? "Failed to reject");
      }
    });
  }

  if (physicians.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-600">All caught up!</p>
        <p className="text-sm text-gray-400 mt-1">No physician applications pending review.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Physician</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Login ID</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Practice</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Medical Rep</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Applied</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {physicians.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                {/* Physician */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#5BB8D4]">
                        {p.firstName[0]}{p.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-xs"> {p.firstName} {p.lastName}</p>
                      <p className="text-xs text-gray-400">{p.email}</p>
                    </div>
                  </div>
                </td>

                {/* Login ID */}
                <td className="px-5 py-4 text-xs text-gray-500">{p.loginId || "Not set"}</td>

                {/* Practice */}
                <td className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-700">
                    {p.nameOfPractice ?? "—"}{p.credential && <span className="text-gray-400"> · {p.credential}</span>}
                  </p>
                  {p.city && (
                    <p className="text-xs text-gray-400">{p.city}{p.state ? `, ${p.state}` : ""}</p>
                  )}
                </td>

                {/* Sales rep */}
                <td className="px-5 py-4">
                  {p.salesRep ? (
                    <div>
                      <p className="text-xs font-medium text-gray-700">{p.salesRep.firstName} {p.salesRep.lastName}</p>
                      <p className="text-xs text-gray-400">{p.salesRep.email}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Sales rep note */}
                <td className="px-5 py-4 max-w-[220px]">
                  {p.salesRepNote ? (
                    <p className="text-xs text-gray-600 italic line-clamp-2">{p.salesRepNote}</p>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Date */}
                <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(p.createdAt)}
                </td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 justify-end">
                    <Link
                      href={`/admin/approvals/${p.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </Link>
                    <Link
                      href={`/admin/approvals/${p.id}/edit`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Link>
                    <button
                      onClick={() => setApproveTarget(p)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget(p)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Approve confirm modal ─────────────────────────── */}
      {approveTarget && (
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
                <p className="text-xs text-gray-500 mt-0.5">
                  {approveTarget.firstName} {approveTarget.lastName} will be approved and sent a setup email.
                </p>
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
                onClick={() => setApproveTarget(null)}
                disabled={isPending}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject confirmation modal ──────────────────────── */}
      {rejectTarget && (
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
                <p className="text-xs text-gray-500 mt-0.5">
                   {rejectTarget.firstName} {rejectTarget.lastName} will be marked as rejected.
                </p>
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
                onClick={() => setRejectTarget(null)}
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
