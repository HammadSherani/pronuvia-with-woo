import Link from "next/link";
import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";
import { formatDate } from "@/lib/utils/timezone";

export const metadata = { title: "My Physicians – Pronuvia" };

const statusBadge: Record<ApprovalStatus, { label: string; cls: string }> = {
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING:  { label: "Pending",  cls: "bg-amber-50  text-amber-700  border-amber-200" },
  REJECTED: { label: "Rejected", cls: "bg-red-50    text-red-700    border-red-200" },
};

export default async function SalesPhysiciansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSalesRep();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const where = { salesRepId: session.userId };
  const [physicians, total] = await Promise.all([
    prisma.partneringPhysician.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, nameOfPractice: true, credential: true, city: true, state: true,
        commission: true, isApproved: true, createdAt: true,
        fieldsOfSpeciality: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.partneringPhysician.count({ where }),
  ]);

  const approvedCount = physicians.filter((p) => p.isApproved === ApprovalStatus.APPROVED).length;
  const pendingCount  = physicians.filter((p) => p.isApproved === ApprovalStatus.PENDING).length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">My Partnering Physicians</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Doctors added under your account ({total} total)
          </p>
        </div>
        <Link
          href="/sales/physicians/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Doctor
        </Link>
      </div>

      {/* Summary chips */}
      {total > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-1 rounded-full bg-gray-900" />
            <div>
              <p className="text-lg font-bold text-gray-800">{total}</p>
              <p className="text-xs text-gray-500">Total Physicians</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-1 rounded-full bg-emerald-400" />
            <div>
              <p className="text-lg font-bold text-gray-800">{approvedCount}</p>
              <p className="text-xs text-gray-500">Approved</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-1 rounded-full bg-amber-400" />
              <div>
                <p className="text-lg font-bold text-gray-800">{pendingCount}</p>
                <p className="text-xs text-gray-500">Pending Approval</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table / empty state */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No physicians added yet</p>
            <p className="text-xs text-gray-400">
              Contact your admin to add partnering physicians under your account.
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Physician</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Practice</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Speciality</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {physicians.map((p) => {
                  const badge = statusBadge[p.isApproved];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-[#5BB8D4]">
                              {p.firstName[0]}{p.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800"> {p.firstName} {p.lastName}</p>
                            <p className="text-xs text-gray-400">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {p.nameOfPractice ?? <span className="text-gray-300">—</span>}
                        {p.credential && <span className="text-gray-400"> · {p.credential}</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-500 text-xs">
                        {p.city && p.state
                          ? `${p.city}, ${p.state}`
                          : p.city || p.state || <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {p.phone ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        {p.fieldsOfSpeciality.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {p.fieldsOfSpeciality.slice(0, 2).map((s) => (
                              <span key={s} className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                {s}
                              </span>
                            ))}
                            {p.fieldsOfSpeciality.length > 2 && (
                              <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-xs">
                                +{p.fieldsOfSpeciality.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                          {p.commission}%
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2 py-0.5 border rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </td>
                    </tr>
                  );
                })}
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
