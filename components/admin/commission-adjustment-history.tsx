"use client";

import { useState, useMemo } from "react";
import { ClientPagination } from "@/components/shared/pagination";
import { formatDate } from "@/lib/utils/timezone";

export type AdjustmentEntry = {
  id:         string;
  userId:     string;
  userRole:   string;
  userName:   string;
  amount:     number;
  type:       string;
  adminEmail: string;
  note:       string;
  balance:    number;
  createdAt:  string; // ISO string
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string) {
  return formatDate(iso, { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  entries: AdjustmentEntry[];
}

export function CommissionAdjustmentHistory({ entries }: Props) {
  const [search,   setSearch]   = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entries.filter((e) => {
      if (typeFilter !== "ALL" && e.type !== typeFilter) return false;
      if (!q) return true;
      return (
        e.userName.toLowerCase().includes(q)  ||
        e.adminEmail.toLowerCase().includes(q) ||
        e.note.toLowerCase().includes(q)
      );
    });
  }, [entries, search, typeFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalCredit = entries.filter((e) => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);
  const totalDebit  = entries.filter((e) => e.type === "DEBIT").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Adjustment History</h2>
          <p className="text-xs text-gray-400 mt-0.5">All manual commission adjustments made by admins</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            Total credited:{" "}
            <span className="font-semibold text-emerald-600">{fmt(totalCredit)}</span>
          </span>
          <span>
            Total debited:{" "}
            <span className="font-semibold text-red-500">{fmt(totalDebit)}</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search user, admin, or note…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["ALL", "CREDIT", "DEBIT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                typeFilter === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "ALL" ? "All" : t === "CREDIT" ? "Credits" : "Debits"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {entries.length === 0 ? "No adjustments have been made yet." : "No adjustments match your filters."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Amount</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Balance After</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paged.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">

                      {/* Date */}
                      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(e.createdAt)}
                      </td>

                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            e.userRole === "SALES_REP" ? "bg-gray-900/10 text-[#3DBFA4]" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {e.userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 leading-none">{e.userName}</p>
                            <span className={`text-[10px] font-semibold ${e.userRole === "SALES_REP" ? "text-[#3DBFA4]" : "text-indigo-500"}`}>
                              {e.userRole === "SALES_REP" ? "Medical Rep" : "Doctor"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          e.type === "CREDIT"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-600 border border-red-200"
                        }`}>
                          {e.type === "CREDIT" ? "+" : "−"}
                          {e.type === "CREDIT" ? " Credit" : " Debit"}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className={`px-5 py-4 text-right font-bold tabular-nums ${
                        e.type === "CREDIT" ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {e.type === "CREDIT" ? "+" : "−"}{fmt(e.amount)}
                      </td>

                      {/* Balance after */}
                      <td className="px-5 py-4 text-right text-sm text-gray-500 tabular-nums">
                        {fmt(e.balance)}
                      </td>

                      {/* Note */}
                      <td className="px-5 py-4 text-sm text-gray-600 max-w-[200px]">
                        <span className="line-clamp-2">{e.note || "—"}</span>
                      </td>

                      {/* Admin */}
                      <td className="px-5 py-4 text-xs text-gray-500 max-w-[160px]">
                        <span className="truncate block" title={e.adminEmail}>{e.adminEmail}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
