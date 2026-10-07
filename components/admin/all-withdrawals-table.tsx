"use client";

import { useState, useMemo } from "react";
import { ClientPagination } from "@/components/shared/pagination";
import { formatDate } from "@/lib/utils/timezone";

export type CommissionEntry = {
  kind:        "rep" | "physician";
  orderId:     string;
  orderNumber: string;
  userId:      string;
  amount:      number;
  rate:        number;
  createdAt:   string;
};

type UserInfo = {
  id:                string;
  firstName:         string;
  lastName:          string;
  email:             string;
  bankName:          string | null;
  bankAccountNumber: string | null;
  bankAccountName:   string | null;
};

interface Props {
  entries: CommissionEntry[];
  repMap:  Map<string, UserInfo>;
  drMap:   Map<string, UserInfo>;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function AllWithdrawalsTable({ entries, repMap, drMap }: Props) {
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }, [entries, page, pageSize]);

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">No commission payouts yet</p>
        <p className="text-xs text-gray-400 mt-1">Credited commissions will appear here when orders are completed.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[18%]" />
          <col className="w-[20%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {paged.map((e) => {
            const isRep = e.kind === "rep";
            const user  = isRep ? repMap.get(e.userId) : drMap.get(e.userId);
            return (
              <tr key={`${e.orderId}-${e.kind}`} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-3">
                  {isRep ? (
                    <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-900/10 text-[#3DBFA4] border border-gray-900/30 whitespace-nowrap">
                      Medical Rep
                    </span>
                  ) : (
                    <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 whitespace-nowrap">
                      Doctor
                    </span>
                  )}
                </td>

                <td className="px-3 py-3">
                  {user ? (
                    <>
                      <p className="font-semibold text-gray-800 text-xs truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                    </>
                  ) : <span className="text-xs text-gray-300">Unknown</span>}
                </td>

                <td className="px-3 py-3">
                  {user?.bankName ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-800 truncate">{user.bankAccountName}</p>
                      <p className="text-[11px] text-gray-500 truncate">{user.bankName}</p>
                      {user.bankAccountNumber && (
                        <p className="text-[11px] font-mono text-gray-600 truncate">{user.bankAccountNumber}</p>
                      )}
                    </div>
                  ) : <span className="text-xs text-red-400 font-medium">No bank</span>}
                </td>

                <td className="px-3 py-3">
                  <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                    #{e.orderNumber}
                  </span>
                </td>

                <td className="px-3 py-3">
                  <span className="inline-flex px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-semibold">
                    {e.rate}%
                  </span>
                </td>

                <td className="px-3 py-3">
                  <span className="text-sm font-bold text-emerald-600">{fmt(e.amount)}</span>
                </td>

                <td className="px-3 py-3 text-[11px] text-gray-400 whitespace-nowrap">
                  {formatDate(e.createdAt, { year: "2-digit" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ClientPagination
        total={entries.length}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={setPageSize}
      />
    </div>
  );
}
