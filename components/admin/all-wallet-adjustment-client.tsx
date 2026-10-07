"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import toast from "react-hot-toast";
import { adjustWallet } from "@/actions/admin/wallet-adjustment";
import { ClientPagination } from "@/components/shared/pagination";

type UserType = "REP" | "DR";

type Person = {
  userType:     UserType;
  id:           string;
  firstName:    string;
  lastName:     string;
  email:        string;
  walletBalance: number;
};

interface Props {
  reps:       { id: string; firstName: string; lastName: string; email: string; walletBalance: number }[];
  physicians: { id: string; firstName: string; lastName: string; email: string; walletBalance: number }[];
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function AllWalletAdjustmentClient({ reps, physicians }: Props) {
  const allPersons: Person[] = [
    ...reps.map((r) => ({ userType: "REP" as const, ...r })),
    ...physicians.map((p) => ({ userType: "DR" as const, ...p })),
  ].sort((a, b) => a.firstName.localeCompare(b.firstName));

  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState<Person | null>(null);
  const [adjType,   setAdjType]   = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount,    setAmount]    = useState("");
  const [note,      setNote]      = useState("");
  const [isPending, startTransition] = useTransition();
  const [page,      setPage]      = useState(1);
  const [pageSize,  setPageSize]  = useState(10);

  const filtered = useMemo(() => {
    if (!search.trim()) return allPersons;
    const q = search.toLowerCase();
    return allPersons.filter((p) =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q)  ||
      p.email.toLowerCase().includes(q)
    );
  }, [search, allPersons]);

  useEffect(() => { setPage(1); }, [filtered]);

  const pagedPersons = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const open  = (p: Person) => { setSelected(p); setAdjType("CREDIT"); setAmount(""); setNote(""); };
  const close = () => setSelected(null);

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (!note.trim())     { toast.error("Note is required.");      return; }

    startTransition(async () => {
      const res = await adjustWallet({
        userId:   selected!.id,
        userRole: selected!.userType === "REP" ? "SALES_REP" : "PHYSICIAN",
        type:     adjType,
        amount:   amt,
        note,
      });

      if (res.success) { toast.success(res.message); close(); }
      else             { toast.error(res.message); }
    });
  };

  return (
    <>
      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No users found.</div>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Wallet Balance</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedPersons.map((person) => (
                <tr key={`${person.userType}-${person.id}`} className="hover:bg-gray-50/50 transition-colors">

                  {/* Type */}
                  <td className="px-5 py-4">
                    {person.userType === "REP" ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-900/10 text-[#3DBFA4] border border-gray-900/30">
                        Medical Rep
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
                        Doctor
                      </span>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        person.userType === "REP" ? "bg-gray-900/10" : "bg-indigo-50"
                      }`}>
                        <span className={`text-xs font-bold ${person.userType === "REP" ? "text-[#3DBFA4]" : "text-indigo-600"}`}>
                          {person.firstName[0]}{person.lastName[0]}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {person.userType === "DR" ? " " : ""}{person.firstName} {person.lastName}
                      </p>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-4 text-sm text-gray-500">{person.email}</td>

                  {/* Balance */}
                  <td className="px-5 py-4">
                    <span className={`text-sm font-bold ${person.walletBalance > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                      {fmt(person.walletBalance)}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => open(person)}
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

      {/* Adjustment modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-800">Commission Adjustment</h3>
                <div className="flex items-center gap-2 mt-1">
                  {selected.userType === "REP" ? (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-900/10 text-[#3DBFA4] border border-gray-900/30">Medical Rep</span>
                  ) : (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">Doctor</span>
                  )}
                  <p className="text-sm text-gray-500">
                    {selected.userType === "DR" ? " " : ""}{selected.firstName} {selected.lastName}
                  </p>
                </div>
              </div>
              <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mb-5 mt-4">
              <span className="text-xs text-gray-500 font-medium">Current balance</span>
              <span className="text-base font-bold text-gray-800">{fmt(selected.walletBalance)}</span>
            </div>

            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setAdjType("CREDIT")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border-2 transition-colors ${
                  adjType === "CREDIT" ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600"
                }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add (Credit)
              </button>
              <button type="button" onClick={() => setAdjType("DEBIT")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border-2 transition-colors ${
                  adjType === "DEBIT" ? "bg-red-500 border-red-500 text-white" : "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600"
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
                  <span className="font-semibold text-gray-700">
                    {fmt(adjType === "CREDIT"
                      ? selected.walletBalance + parseFloat(amount)
                      : Math.max(0, selected.walletBalance - parseFloat(amount)))}
                  </span>
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
                  adjType === "CREDIT" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                }`}>
                {isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : adjType === "CREDIT" ? "Add Commission" : "Deduct Commission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
