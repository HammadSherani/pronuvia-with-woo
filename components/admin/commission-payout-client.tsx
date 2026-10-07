"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { updateWithdrawRequest, deleteWithdrawRequest, bulkUpdateWithdrawals } from "@/actions/admin/manage-withdrawals";
import { notifyUserAddBank } from "@/actions/admin/notify-bank";
import { formatDate, formatMonthYear } from "@/lib/utils/timezone";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  orderNumber: string;
  createdAt: string;
  amount: number;
  rate: number;
  refundedAt?: string;
  reason?: string | null;
};

type UserInfo = {
  firstName:         string;
  lastName:          string;
  email:             string;
  bankName:          string | null;
  bankAccountNumber: string | null;
  bankAccountName:   string | null;
};

export type PendingRow = {
  id:        string;
  userId:    string;
  userRole:  "PHYSICIAN" | "SALES_REP";
  amount:    number;
  note:      string | null;
  createdAt: string;
  user:      UserInfo;
  orders:    OrderRow[];
};

export type RejectedRow = {
  id:        string;
  userId:    string;
  userRole:  "PHYSICIAN" | "SALES_REP";
  amount:    number;
  note:      string | null;
  adminNote: string | null;
  createdAt: string;
  user:      UserInfo;
};

export type CurrentMonthEntry = {
  userId:          string;
  userRole:        "PHYSICIAN" | "SALES_REP";
  userName:        string;
  userEmail:       string;
  orderCount:      number;
  totalCommission: number;
  orders:          OrderRow[];
};

export type RejectedCommissionEntry = {
  userId:                 string;
  userRole:               "PHYSICIAN" | "SALES_REP";
  userName:               string;
  userEmail:              string;
  orderCount:             number;
  totalRejectedCommission: number;
  orders:                 OrderRow[];
};

interface Props {
  pending:      PendingRow[];
  rejected:     RejectedRow[];
  currentMonth: CurrentMonthEntry[];
  rejectedCommission: RejectedCommissionEntry[];
  monthLabel:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function parsePeriod(note: string | null, createdAt: string): string {
  if (note) {
    const m = note.match(/Auto withdrawal\s*[–-]\s*(.+)/i);
    if (m) return m[1].trim();
  }
  return formatMonthYear(createdAt);
}

function RoleBadge({ role }: { role: "PHYSICIAN" | "SALES_REP" }) {
  return role === "PHYSICIAN"
    ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">Doctor</span>
    : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-[#3DBFA4] border border-teal-200">Medical Rep</span>;
}

function Avatar({ name, role }: { name: string; role: "PHYSICIAN" | "SALES_REP" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
      role === "PHYSICIAN" ? "bg-indigo-50 text-indigo-600" : "bg-teal-50 text-[#3DBFA4]"
    }`}>
      {initials}
    </div>
  );
}

// ── Current-month orders modal ────────────────────────────────────────────────

function OrdersModal({
  name, period, orders, rejected = false, onClose,
}: {
  name: string; period: string; orders: OrderRow[]; rejected?: boolean; onClose: () => void;
}) {
  const total = orders.reduce((s, o) => s + o.amount, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${rejected ? "max-w-3xl" : "max-w-xl"} max-h-[80vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              {rejected ? "Refunded Commission Orders" : "Commission Orders"}
            </p>
            <h3 className="text-base font-bold text-gray-800 mt-0.5">{name} — {period}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {orders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-400">No orders found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 sticky top-0">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Date</th>
                  {rejected && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Refunded</th>}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                  {rejected && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>}
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {rejected ? "Rejected Commission" : "Commission"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">#{o.orderNumber}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {formatDate(o.createdAt)}
                    </td>
                    {rejected && (
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {o.refundedAt
                          ? formatDate(o.refundedAt)
                          : "—"}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-semibold">{o.rate}%</span>
                    </td>
                    {rejected && (
                      <td className="px-5 py-3 text-xs text-gray-500 max-w-40 truncate" title={o.reason ?? ""}>
                        {o.reason || "Refunded order"}
                      </td>
                    )}
                    <td className={`px-5 py-3 text-right font-bold text-sm ${rejected ? "text-red-600" : "text-emerald-600"}`}>{fmt(o.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
          </span>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Commission</p>
            <p className="text-base font-black text-emerald-600">{fmt(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Approve / Reject modal ────────────────────────────────────────────────────

function ActionModal({
  row, action, onClose, onDone,
}: {
  row: PendingRow; action: "APPROVED" | "REJECTED"; onClose: () => void; onDone: (id: string) => void;
}) {
  const [note, setNote]         = useState("");
  const [busy, startTransition] = useTransition();
  const period                  = parsePeriod(row.note, row.createdAt);
  const isApprove               = action === "APPROVED";

  const handle = () => {
    startTransition(async () => {
      const res = await updateWithdrawRequest(row.id, action, note);
      if (res?.success) {
        toast.success(isApprove
          ? `Approved ${fmt(row.amount)} — email + PDF sent to ${row.user.email}`
          : "Request rejected.");
        onDone(row.id);
        onClose();
      } else {
        toast.error(res?.message ?? "Something went wrong.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-gray-800 mb-1">
          {isApprove ? "Approve Payout" : "Reject Request"}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {isApprove
            ? `Approve ${fmt(row.amount)} commission payout for ${row.user.firstName} ${row.user.lastName} (${period})?`
            : `Reject the ${fmt(row.amount)} commission request for ${row.user.firstName} ${row.user.lastName}?`}
        </p>
        {isApprove && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 text-xs text-emerald-700 font-medium">
            Commission balance will be deducted and a PDF statement will be emailed to {row.user.email}
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
            placeholder={isApprove ? "e.g. Paid via ACH on Aug 5" : "e.g. Insufficient balance"}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handle} disabled={busy}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-colors ${
              isApprove ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
            }`}>
            {busy
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : isApprove ? "Approve & Send" : "Reject"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk approve modal ────────────────────────────────────────────────────────

function BulkApproveModal({
  count, totalAmount, busy, onClose, onConfirm,
}: {
  count: number; totalAmount: number; busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-800 mb-1">Bulk Approve {count} Payout{count !== 1 ? "s" : ""}</h3>
        <p className="text-sm text-gray-500 mb-4">
          Approve <span className="font-semibold text-gray-800">{count} request{count !== 1 ? "s" : ""}</span> totalling{" "}
          <span className="font-semibold text-emerald-600">{fmt(totalAmount)}</span>?
          Each user&apos;s commission balance will be deducted.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl disabled:opacity-50 transition-colors">
            {busy
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : "Approve All"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, countColor }: { title: string; count: number; countColor: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-base font-bold text-gray-800">{title}</h2>
      {count > 0 && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${countColor}`}>
          {count}
        </span>
      )}
    </div>
  );
}

const COMMISSION_PAGE_SIZE = 10;

function TablePagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.ceil(total / COMMISSION_PAGE_SIZE);
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-2.5 py-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <span className="text-xs text-gray-500 whitespace-nowrap">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        className="px-2.5 py-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommissionPayoutClient({ pending: initialPending, rejected, currentMonth, rejectedCommission, monthLabel }: Props) {
  const [pending,      setPending]     = useState(initialPending);
  const [selected,     setSelected]    = useState<Set<string>>(new Set());
  const [bulkModal,    setBulkModal]   = useState(false);
  const [ordersModal,  setOrdersModal] = useState<{ name: string; period: string; orders: OrderRow[]; rejected?: boolean } | null>(null);
  const [actionModal,  setActionModal] = useState<{ row: PendingRow; action: "APPROVED" | "REJECTED" } | null>(null);
  const [confirmDel,   setConfirmDel]  = useState<PendingRow | null>(null);
  const [pendingPage,  setPendingPage] = useState(1);
  const [currentPage,  setCurrentPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [deleting,     startDelete]    = useTransition();
  const [bulkBusy,     startBulk]     = useTransition();
  const [,             startNotify]   = useTransition();

  const removeRow  = (id: string)      => { setPending((p) => p.filter((r) => r.id !== id)); setSelected((s) => { const n = new Set(s); n.delete(id); return n; }); };
  const removeRows = (ids: string[])   => { const set = new Set(ids); setPending((p) => p.filter((r) => !set.has(r.id))); setSelected(new Set()); };

  const hasBank       = (r: PendingRow) => Boolean(
    r.user.bankName && r.user.bankAccountNumber && r.user.bankAccountName,
  );
  const bankRows      = pending.filter(hasBank);
  const allBankSel    = bankRows.length > 0 && bankRows.every((r) => selected.has(r.id));
  const someSel       = selected.size > 0 && !allBankSel;
  const toggleSelect  = (id: string, hasBankAcc: boolean) => {
    if (!hasBankAcc) return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleAll     = () => setSelected(allBankSel ? new Set() : new Set(bankRows.map((r) => r.id)));

  const selectedRows  = pending.filter((r) => selected.has(r.id) && hasBank(r));
  const selectedTotal = selectedRows.reduce((s, r) => s + r.amount, 0);

  const handleBulkApprove = () => {
    const ids = selectedRows.map((r) => r.id);   // only bank-account rows
    startBulk(async () => {
      const res = await bulkUpdateWithdrawals(ids, "APPROVED");
      if (res.success) {
        toast.success(res.message);
        removeRows(ids);
      } else {
        toast.error(res.message);
      }
      setBulkModal(false);
    });
  };

  const handleDelete = (row: PendingRow) => {
    startDelete(async () => {
      const res = await deleteWithdrawRequest(row.id);
      if (res?.success) { toast.success("Request removed."); removeRow(row.id); }
      else              { toast.error(res?.message ?? "Failed."); }
      setConfirmDel(null);
    });
  };

  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
  const currentTotal = currentMonth.reduce((s, e) => s + e.totalCommission, 0);
  const rejectedCommissionTotal = rejectedCommission.reduce((s, e) => s + e.totalRejectedCommission, 0);

  const pendingPageCount = Math.max(1, Math.ceil(pending.length / COMMISSION_PAGE_SIZE));
  const currentPageCount = Math.max(1, Math.ceil(currentMonth.length / COMMISSION_PAGE_SIZE));
  const rejectedPageCount = Math.max(1, Math.ceil(rejectedCommission.length / COMMISSION_PAGE_SIZE));
  const visiblePendingPage = Math.min(pendingPage, pendingPageCount);
  const visibleCurrentPage = Math.min(currentPage, currentPageCount);
  const visibleRejectedPage = Math.min(rejectedPage, rejectedPageCount);
  const pagedPending = pending.slice((visiblePendingPage - 1) * COMMISSION_PAGE_SIZE, visiblePendingPage * COMMISSION_PAGE_SIZE);
  const pagedCurrentMonth = currentMonth.slice((visibleCurrentPage - 1) * COMMISSION_PAGE_SIZE, visibleCurrentPage * COMMISSION_PAGE_SIZE);
  const pagedRejectedCommission = rejectedCommission.slice((visibleRejectedPage - 1) * COMMISSION_PAGE_SIZE, visibleRejectedPage * COMMISSION_PAGE_SIZE);

  return (
    <>
      {/* ══ 1. Commission Payout (pending withdraw requests — previous months) ═ */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="Commission Payout"
            count={pending.length}
            countColor="bg-emerald-100 text-emerald-700 border-emerald-200"
          />
          {selected.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                <span className="font-bold text-gray-800">{selectedRows.length}</span> with bank selected
                {" · "}<span className="font-bold text-emerald-600">{fmt(selectedTotal)}</span>
              </span>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setBulkModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {bulkBusy
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                }
                Approve Selected
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">All caught up — no pending payouts</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {/* Select-all (bank-account rows only) */}
                    <th className="pl-4 pr-2 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allBankSel}
                        ref={(el) => { if (el) el.indeterminate = someSel; }}
                        onChange={toggleAll}
                        disabled={bankRows.length === 0}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-500 cursor-pointer accent-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </th>
                    <th className="text-left px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedPending.map((row) => {
                    const period    = parsePeriod(row.note, row.createdAt);
                    const rowHasBank = hasBank(row);
                    const isChecked  = selected.has(row.id);
                    return (
                      <tr key={row.id} className={`transition-colors ${isChecked ? "bg-emerald-50/40" : !rowHasBank ? "bg-amber-50/20" : "hover:bg-gray-50/40"}`}>
                        {/* Checkbox — disabled for rows without bank */}
                        <td className="pl-4 pr-2 py-3.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(row.id, rowHasBank)}
                            disabled={!rowHasBank}
                            title={!rowHasBank ? "No bank account — cannot approve" : undefined}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-500 accent-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          />
                        </td>
                        {/* Name */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={`${row.user.firstName} ${row.user.lastName}`} role={row.userRole} />
                            <div>
                              <p className="text-sm font-semibold text-gray-800 leading-none">{row.user.firstName} {row.user.lastName}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{row.user.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td className="px-5 py-3.5">
                          <RoleBadge role={row.userRole} />
                        </td>
                        {/* Period */}
                        <td className="px-5 py-3.5 text-xs font-medium text-gray-600">{period}</td>
                        {/* Bank */}
                        <td className="px-5 py-3.5">
                          {rowHasBank ? (
                            <span className="text-xs text-gray-600">{row.user.bankAccountName ?? row.user.bankName}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                              No bank
                            </span>
                          )}
                        </td>
                        {/* Amount */}
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-base font-black text-gray-800">{fmt(row.amount)}</span>
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Link
                              href={`/admin/withdrawals/${row.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Show orders
                            </Link>
                            {!rowHasBank ? (
                              /* No bank account — show Notify button only */
                              <button
                                type="button"
                                title="Notify user to add bank account"
                                onClick={() =>
                                  startNotify(async () => {
                                    const res = await notifyUserAddBank(row.userId, row.userRole);
                                    if (res.success) toast.success("User notified to add bank account");
                                    else toast.error(res.message);
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                Notify
                              </button>
                            ) : (
                              <>
                            <button
                              type="button"
                              onClick={() => setActionModal({ row, action: "APPROVED" })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setActionModal({ row, action: "REJECTED" })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDel(row)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove request"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-400">{pending.length} request{pending.length !== 1 ? "s" : ""} pending</span>
                <TablePagination page={visiblePendingPage} total={pending.length} onPageChange={setPendingPage} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Total pending</span>
                  <span className="text-sm font-black text-emerald-600">{fmt(pendingTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ 2. Pending Commission (current month) ════════════════════════════ */}
      <div className="mb-8">
        <SectionHeader
          title={`Pending Commission — ${monthLabel}`}
          count={currentMonth.length}
          countColor="bg-amber-100 text-amber-700 border-amber-200"
        />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {currentMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No commission earned this month yet</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedCurrentMonth.map((entry) => (
                    <tr key={`${entry.userRole}-${entry.userId}`} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={entry.userName} role={entry.userRole} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800 leading-none">{entry.userName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{entry.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={entry.userRole} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {entry.orderCount}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-base font-black text-amber-600">{fmt(entry.totalCommission)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setOrdersModal({ name: entry.userName, period: monthLabel, orders: entry.orders })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          View Orders
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-400">{currentMonth.length} user{currentMonth.length !== 1 ? "s" : ""}</span>
                <TablePagination page={visibleCurrentPage} total={currentMonth.length} onPageChange={setCurrentPage} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Total this month</span>
                  <span className="text-sm font-black text-amber-600">{fmt(currentTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ 3. Rejected Commission (refund clawbacks) ═════════════════════════ */}
      <div className="mb-8">
        <SectionHeader
          title={`Rejected Commission — ${monthLabel}`}
          count={rejectedCommission.length}
          countColor="bg-red-100 text-red-600 border-red-200"
        />
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {rejectedCommission.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No refunded commission this month</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejected Commission</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedRejectedCommission.map((entry) => (
                    <tr key={`${entry.userRole}-${entry.userId}`} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={entry.userName} role={entry.userRole} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800 leading-none">{entry.userName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{entry.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><RoleBadge role={entry.userRole} /></td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-xs font-bold text-red-600">{entry.orderCount}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right"><span className="text-base font-black text-red-600">{fmt(entry.totalRejectedCommission)}</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setOrdersModal({ name: entry.userName, period: monthLabel, orders: entry.orders, rejected: true })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          View Refunds
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-400">{rejectedCommission.length} user{rejectedCommission.length !== 1 ? "s" : ""}</span>
                <TablePagination page={visibleRejectedPage} total={rejectedCommission.length} onPageChange={setRejectedPage} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Total rejected</span>
                  <span className="text-sm font-black text-red-600">{fmt(rejectedCommissionTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ 4. Rejected payout requests (compact) ════════════════════════════ */}
      {rejected.length > 0 && (
        <div className="border-t border-gray-100 pt-6">
          <SectionHeader
            title="Rejected Payout Requests"
            count={rejected.length}
            countColor="bg-red-100 text-red-600 border-red-200"
          />
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[22%]" /><col className="w-[10%]" /><col className="w-[14%]" />
                <col className="w-[12%]" /><col className="w-[14%]" /><col className="w-[28%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejected On</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rejected.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 text-xs truncate">{r.user.firstName} {r.user.lastName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{r.user.email}</p>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={r.userRole} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-medium">{parsePeriod(r.note, r.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-700">{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(r.createdAt, { year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 italic truncate" title={r.adminNote ?? ""}>
                      {r.adminNote ?? <span className="text-gray-300 not-italic">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Modals ════════════════════════════════════════════════════════════ */}
      {bulkModal && (
        <BulkApproveModal
          count={selected.size}
          totalAmount={selectedTotal}
          busy={bulkBusy}
          onClose={() => setBulkModal(false)}
          onConfirm={handleBulkApprove}
        />
      )}

      {ordersModal && (
        <OrdersModal
          name={ordersModal.name}
          period={ordersModal.period}
          orders={ordersModal.orders}
          rejected={ordersModal.rejected}
          onClose={() => setOrdersModal(null)}
        />
      )}

      {actionModal && (
        <ActionModal
          row={actionModal.row}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onDone={removeRow}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">Remove Request</h3>
            <p className="text-sm text-gray-500 mb-5">
              Remove the pending payout request for {confirmDel.user.firstName} {confirmDel.user.lastName}?
              The commission balance is not affected.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDel(null)} disabled={deleting}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => handleDelete(confirmDel)} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-colors">
                {deleting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
