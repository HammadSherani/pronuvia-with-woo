import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { Role, WithdrawStatus } from "@/generated/prisma/enums";
import Link from "next/link";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";
import { formatDate } from "@/lib/utils/timezone";

export const metadata = { title: "Payout History – Pronuvia" };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function SalesWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSalesRep();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  // Only fetch APPROVED payouts
  const where = { userId: session.userId, userRole: Role.SALES_REP, status: WithdrawStatus.APPROVED };

  const [rep, [requests, total]] = await Promise.all([
    prisma.salesRepresentative.findUnique({
      where:  { id: session.userId },
      select: { bankName: true },
    }),
    Promise.all([
      prisma.withdrawRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.withdrawRequest.count({ where }),
    ]),
  ]);

  const bankName = rep?.bankName;
  const totalPaidOut = requests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Payout History</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your commission payout history ({total} total)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Total Paid Out", value: fmt(totalPaidOut), color: "#5BB8D4" },
          { label: "Total Payouts",  value: String(total),     color: "#8b5cf6" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="w-8 h-1 rounded-full mb-3" style={{ background: c.color }} />
            <p className="text-xl font-bold text-gray-800">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {!rep?.bankName && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-2.194-.834-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Bank details not set</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Add your bank details in{" "}
              <Link href="/sales/account" className="underline font-medium">Account Settings</Link>
              {" "}so payouts can be processed.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No payouts yet</p>
            <p className="text-xs text-gray-400 mt-1">Your payout history will appear here once approved.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[16%]" />
                <col className="w-[34%]" />
                <col className="w-[21%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid Amount</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payout Method</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payout Comments</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-sm text-emerald-600">
                        {fmt(r.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 truncate">
                      {bankName ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 max-w-0">
                      {r.adminNote ? (
                        <p className="text-xs text-gray-700 line-clamp-2 leading-snug" title={r.adminNote}>
                          {r.adminNote}
                        </p>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={`/api/sales/commission-statement/${r.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b3b6f] hover:text-[#3DBFA4] transition-colors group"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#3DBFA4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Suspense>
              <Pagination total={total} page={page} pageSize={pageSize} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
