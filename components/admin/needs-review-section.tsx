"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { payOldBalances, cancelOldBalances } from "@/actions/admin/old-balances";
import { formatDate } from "@/lib/utils/timezone";

export type NeedsReviewLine = {
  id:          string;
  orderNumber: string | null;
  date:        string;          // the commission's date (old site)
  periodLabel: string;
  amount:      number;
  note:        string | null;
};

export type NeedsReviewEntry = {
  userId:    string;
  userRole:  "PHYSICIAN" | "SALES_REP";
  userName:  string;
  userEmail: string;
  total:     number;
  lines:     NeedsReviewLine[];
};

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * "Needs review": old-site commission dated on or before 12/31/2025. Nothing
 * here is paid until the admin moves it to Commission Payout ("Pay"); "Cancel"
 * drops it (with a reason).
 */
export function NeedsReviewSection({ entries }: { entries: NeedsReviewEntry[] }) {
  const [open, setOpen] = useState<NeedsReviewEntry | null>(null);
  if (!entries.length) return null;
  const total = entries.reduce((s, e) => s + e.total, 0);
  const lineCount = entries.reduce((s, e) => s + e.lines.length, 0);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-1">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Needs Review</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border bg-amber-100 text-amber-700 border-amber-200">{entries.length}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Unpaid commission from the old site dated on or before 12/31/2025 ({lineCount} line{lineCount !== 1 ? "s" : ""}, {fmt(total)}).
        It is not paid until you move it to Commission Payout. Cancel what is incorrect.
      </p>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lines</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.map((e) => (
              <tr key={`${e.userId}:${e.userRole}`} className="hover:bg-gray-50/40">
                <td className="px-5 py-3">
                  <p className="text-sm font-semibold text-gray-800 leading-none">{e.userName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{e.userEmail}</p>
                </td>
                <td className="px-5 py-3 text-xs text-gray-600">{e.userRole === "PHYSICIAN" ? "Doctor" : "Medical Rep"}</td>
                <td className="px-5 py-3 text-xs text-gray-600">{e.lines.length}</td>
                <td className="px-5 py-3 text-right font-black text-gray-800">{fmt(e.total)}</td>
                <td className="px-5 py-3 text-right">
                  <button type="button" onClick={() => setOpen(e)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <ReviewModal entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ReviewModal({ entry, onClose }: { entry: NeedsReviewEntry; onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(entry.lines.map((l) => l.id)));
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();
  const chosen = entry.lines.filter((l) => selected.has(l.id));
  const chosenTotal = chosen.reduce((s, l) => s + l.amount, 0);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = (kind: "pay" | "cancel") => start(async () => {
    const ids = chosen.map((l) => l.id);
    const res = kind === "pay" ? await payOldBalances(ids) : await cancelOldBalances(ids, reason);
    if (res.success) { toast.success(res.message); onClose(); router.refresh(); }
    else toast.error(res.message);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
        <h3 id="review-title" className="text-base font-bold text-gray-800">Review old commission: {entry.userName}</h3>
        <p className="text-xs text-gray-500 mb-4">{entry.userEmail} · {entry.userRole === "PHYSICIAN" ? "Doctor" : "Medical Rep"}</p>
        <div className="overflow-auto border border-gray-100 rounded-xl mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="pl-4 pr-2 py-2.5 w-10">
                  <input type="checkbox" aria-label="Select all" checked={chosen.length === entry.lines.length}
                    onChange={() => setSelected(chosen.length === entry.lines.length ? new Set() : new Set(entry.lines.map((l) => l.id)))}
                    className="w-4 h-4 accent-emerald-500" />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Note</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entry.lines.map((l) => (
                <tr key={l.id} className={selected.has(l.id) ? "bg-amber-50/30" : ""}>
                  <td className="pl-4 pr-2 py-2"><input type="checkbox" aria-label={`Select order ${l.orderNumber ?? ""}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="w-4 h-4 accent-emerald-500" /></td>
                  <td className="px-3 py-2 text-xs font-medium text-gray-700">{l.orderNumber ? `#${l.orderNumber}` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(l.date)} <span className="text-gray-400">({l.periodLabel})</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{l.note ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-sm font-bold text-gray-800">{fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="cancel-reason">
          Reason <span className="normal-case font-normal text-gray-400">(needed to cancel)</span>
        </label>
        <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry from the old site"
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500 mr-auto">{chosen.length} selected · <span className="font-bold text-gray-800">{fmt(chosenTotal)}</span></span>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-50">Close</button>
          <button type="button" onClick={() => run("cancel")} disabled={busy || !chosen.length || !reason.trim()}
            title={!reason.trim() ? "Enter a reason first" : undefined}
            className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl disabled:opacity-40">
            Cancel selected
          </button>
          <button type="button" onClick={() => run("pay")} disabled={busy || !chosen.length}
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl disabled:opacity-40">
            Move selected to payout
          </button>
        </div>
      </div>
    </div>
  );
}
