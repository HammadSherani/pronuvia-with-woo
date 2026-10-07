"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import toast from "react-hot-toast";
import { adjustPhysicianWallet } from "@/actions/admin/physician-wallet-adjustment";
import { ClientPagination } from "@/components/shared/pagination";

type Physician = {
  id:            string;
  firstName:     string;
  lastName:      string;
  email:         string;
  walletBalance: number;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function PhysicianWalletAdjustmentClient({ physicians }: { physicians: Physician[] }) {
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState<Physician | null>(null);
  const [type,      setType]      = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount,    setAmount]    = useState("");
  const [note,      setNote]      = useState("");
  const [isPending, startTransition] = useTransition();
  const [page,      setPage]      = useState(1);
  const [pageSize,  setPageSize]  = useState(10);

  const filtered = useMemo(() => {
    if (!search.trim()) return physicians;
    const q = search.toLowerCase();
    return physicians.filter((p) =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q)  ||
      p.email.toLowerCase().includes(q)
    );
  }, [search, physicians]);

  useEffect(() => { setPage(1); }, [filtered]);

  const pagedPhysicians = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const open = (p: Physician) => { setSelected(p); setType("CREDIT"); setAmount(""); setNote(""); };
  const close = () => setSelected(null);

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (!note.trim())     { toast.error("Note is required.");     return; }

    startTransition(async () => {
      const res = await adjustPhysicianWallet({ userId: selected!.id, userRole: "PHYSICIAN", type, amount: amt, note });
      if (res.success) { toast.success(res.message); close(); }
      else { toast.error(res.message); }
    });
  };

  return (
    <>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search physicians…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No physicians found.</div>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Physician</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Wallet Balance</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedPhysicians.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#3DBFA4]">{p.firstName[0]}{p.lastName[0]}</span>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm"> {p.firstName} {p.lastName}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{p.email}</td>
                  <td className="px-5 py-4">
                    <span className={`text-sm font-bold ${p.walletBalance > 0 ? "text-emerald-600" : p.walletBalance < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {fmt(p.walletBalance)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => open(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900/10 text-[#3DBFA4] border border-gray-900/30 rounded-lg hover:bg-gray-900/20 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Adjust Commission
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ClientPagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-800">Commission Adjustment</h3>
                <p className="text-sm text-gray-500 mt-0.5"> {selected.firstName} {selected.lastName}</p>
              </div>
              <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-5">
              <span className="text-xs text-gray-500 font-medium">Current balance</span>
              <span className="text-base font-bold text-gray-800">{fmt(selected.walletBalance)}</span>
            </div>

            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setType("CREDIT")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border-2 transition-colors ${
                  type === "CREDIT" ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600"
                }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add (Credit)
              </button>
              <button type="button" onClick={() => setType("DEBIT")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border-2 transition-colors ${
                  type === "DEBIT" ? "bg-red-500 border-red-500 text-white" : "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600"
                }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
                Deduct (Debit)
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors" />
              </div>
              {amount && parseFloat(amount) > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  New balance:{" "}
                  {(() => {
                    const nb = type === "CREDIT"
                      ? selected.walletBalance + parseFloat(amount)
                      : selected.walletBalance - parseFloat(amount);
                    return (
                      <span className={`font-semibold ${nb < 0 ? "text-red-600" : "text-gray-700"}`}>
                        {fmt(nb)}
                      </span>
                    );
                  })()}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Note <span className="text-red-400">*</span>
              </label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for adjustment…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 resize-none transition-colors" />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={close} disabled={isPending}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-colors ${
                  type === "CREDIT" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                }`}>
                {isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : type === "CREDIT" ? "Add Commission" : "Deduct Commission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
