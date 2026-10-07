"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { WithdrawalActions } from "@/components/admin/withdrawal-actions";
import { RepWalletModal }    from "@/components/admin/rep-wallet-modal";
import { bulkUpdateWithdrawals } from "@/actions/admin/manage-withdrawals";
import { WithdrawStatus }    from "@/generated/prisma/enums";
import { formatDate } from "@/lib/utils/timezone";

type Request = {
  id:         string;
  amount:     number;
  status:     WithdrawStatus;
  note:       string | null;
  adminNote:  string | null;
  createdAt:  Date;
  salesRepId: string;
  salesRep: {
    firstName:         string;
    lastName:          string;
    email:             string;
    bankName:          string | null;
    bankAccountNumber: string | null;
    bankAccountName:   string | null;
    bankAccountType:   string | null;
    bankOwnershipType: string | null;
    walletBalance:     number | null;
  };
};

const statusStyle: Record<WithdrawStatus, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function WithdrawalsTableClient({ requests }: { requests: Request[] }) {
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [isPending,   startTransition] = useTransition();

  const pendingIds = requests.filter((r) => r.status === "PENDING").map((r) => r.id);
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pendingIds));

  const handleBulk = (action: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      const res = await bulkUpdateWithdrawals([...selected], action);
      if (res.success) {
        toast.success(res.message);
        setSelected(new Set());
      } else {
        toast.error(res.message);
      }
      setConfirmAction(null);
    });
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">No withdrawal requests yet</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Bulk action bar ─────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-800">
            {selected.size} request{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction("APPROVED")}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Approve All
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("REJECTED")}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject All
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-8" />
          <col className="w-[18%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="px-3 py-3">
              {pendingIds.length > 0 && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  title="Select all pending"
                  className="w-4 h-4 rounded border-gray-300 accent-gray-900 cursor-pointer"
                />
              )}
            </th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Medical Rep</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comm. Balance</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Wallet</th>
            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {requests.map((r) => {
            const isPending = r.status === "PENDING";
            const isChecked = selected.has(r.id);
            return (
              <tr
                key={r.id}
                className={`hover:bg-gray-50/50 transition-colors ${isChecked ? "bg-blue-50/40" : ""}`}
              >
                {/* Checkbox */}
                <td className="px-3 py-3">
                  {isPending ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(r.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-gray-900 cursor-pointer"
                    />
                  ) : (
                    <span className="block w-4 h-4" />
                  )}
                </td>

                {/* Sales rep */}
                <td className="px-3 py-3">
                  <p className="font-semibold text-gray-800 text-xs truncate">
                    {r.salesRep.firstName} {r.salesRep.lastName}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{r.salesRep.email}</p>
                </td>

                {/* Bank details */}
                <td className="px-3 py-3">
                  {r.salesRep.bankName ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-800 truncate">{r.salesRep.bankAccountName}</p>
                      <p className="text-[11px] text-gray-500 truncate">{r.salesRep.bankName}</p>
                      <p className="text-[11px] text-gray-500 truncate">{r.salesRep.bankAccountType} · {r.salesRep.bankOwnershipType}</p>
                      {r.salesRep.bankAccountNumber && (
                        <p className="text-[11px] font-mono text-gray-600 truncate">{r.salesRep.bankAccountNumber}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-red-400 font-medium">No bank</span>
                  )}
                </td>

                {/* Amount */}
                <td className="px-3 py-3">
                  <span className="text-sm font-bold text-gray-800">{fmt(r.amount)}</span>
                </td>

                {/* Wallet balance */}
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold ${
                    (r.salesRep.walletBalance ?? 0) >= r.amount ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {fmt(r.salesRep.walletBalance ?? 0)}
                  </span>
                  {r.status === "PENDING" && (
                    <p className={`text-[10px] ${((r.salesRep.walletBalance ?? 0) < r.amount) ? "text-red-400" : "text-emerald-500"}`}>
                      {((r.salesRep.walletBalance ?? 0) < r.amount) ? "Insufficient" : "Available"}
                    </p>
                  )}
                </td>

                {/* Note */}
                <td className="px-3 py-3 space-y-1">
                  {r.note ? (
                    <p className="text-[11px] text-gray-500 italic line-clamp-2" title={r.note}>"{r.note}"</p>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                  {r.adminNote && (
                    <div className="mt-1">
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wide text-[#3DBFA4] bg-gray-900/10 border border-gray-900/30 px-1.5 py-0.5 rounded mb-0.5">
                        Admin
                      </span>
                      <p className="text-[11px] text-gray-700 line-clamp-2 leading-snug" title={r.adminNote}>
                        {r.adminNote}
                      </p>
                    </div>
                  )}
                </td>

                {/* Date */}
                <td className="px-3 py-3 text-[11px] text-gray-400">
                  {formatDate(r.createdAt, { year: "2-digit" })}
                </td>

                {/* Status */}
                <td className="px-3 py-3">
                  <span className={`inline-flex px-1.5 py-0.5 border rounded-full text-[11px] font-medium ${statusStyle[r.status]}`}>
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </td>

                {/* Wallet modal */}
                <td className="px-3 py-3 text-center">
                  <RepWalletModal
                    salesRepId={r.salesRepId}
                    repName={`${r.salesRep.firstName} ${r.salesRep.lastName}`}
                  />
                </td>

                {/* Individual actions */}
                <td className="px-3 py-3 text-right">
                  {r.status === "PENDING" ? (
                    <WithdrawalActions requestId={r.id} />
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Bulk confirm modal ──────────────────────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {confirmAction === "APPROVED" ? "Bulk Approve" : "Bulk Reject"}{" "}
              {selected.size} Request{selected.size !== 1 ? "s" : ""}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmAction === "APPROVED"
                ? "Amounts will be deducted from each user's commission balance."
                : "All selected requests will be marked as rejected."}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isPending}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBulk(confirmAction)}
                disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-colors ${
                  confirmAction === "APPROVED"
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : confirmAction === "APPROVED" ? "Approve All" : "Reject All"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
