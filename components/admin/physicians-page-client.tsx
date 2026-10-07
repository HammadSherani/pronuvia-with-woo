"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { deletePhysician } from "@/actions/admin/manage-physicians";
import { DeleteButton } from "@/components/admin/delete-button";
import { PhysicianApprovalActions } from "@/components/admin/physician-approval-actions";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { ClientPagination } from "@/components/shared/pagination";
import { formatDate, toDateInputValue } from "@/lib/utils/timezone";

// ─── Types ────────────────────────────────────────────────────────────────────

type Physician = {
  id: string; isApproved: ApprovalStatus;
  firstName: string; lastName: string; email: string; loginId: string | null;
  nameOfPractice: string | null; phone: string | null;
  officeContactNumber: string | null; fax: string | null;
  addressOne: string | null; addressTwo: string | null;
  city: string | null; state: string | null; zipCode: string | null; country: string | null;
  license: string | null; aictherapy: string | null; websiteLink: string | null;
  fieldsOfSpeciality: string[]; yearsInPractice: number | null;
  credential: string | null; patientsPerMonth: number | null;
  commission: number; uplineCommission: number;
  walletBalance: number; ordersCount: number;
  addedByRole: string; salesRepId: string | null;
  salesRep: { id: string; name: string; firstName: string; lastName: string; email: string; commission: number } | null;
  createdAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge: Record<ApprovalStatus, { label: string; cls: string }> = {
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING:  { label: "Pending",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
};

function match(text: string, q: string) {
  return text.toLowerCase().includes(q.toLowerCase());
}

function exportToExcel(physicians: Physician[]) {
  const rows = physicians.map((p) => ({
    "First Name":               p.firstName,
    "Last Name":                p.lastName,
    "Email":                    p.email,
    "Login ID":                 p.loginId ?? "",
    "Phone":                    p.phone ?? "",
    "Office Phone":             p.officeContactNumber ?? "",
    "Fax":                      p.fax ?? "",
    "Practice Name":            p.nameOfPractice ?? "",
    "Website":                  p.websiteLink ?? "",
    "License":                  p.license ?? "",
    "AIC Therapy":              p.aictherapy ?? "",
    "Fields of Specialty":      p.fieldsOfSpeciality.join(", "),
    "Years in Practice":        p.yearsInPractice ?? "",
    "Credential":               p.credential ?? "",
    "Patients Seen Per Month":  p.patientsPerMonth ?? "",
    "Address 1":                p.addressOne ?? "",
    "Address 2":                p.addressTwo ?? "",
    "City":                     p.city ?? "",
    "State":                    p.state ?? "",
    "Zip Code":                 p.zipCode ?? "",
    "Country":                  p.country ?? "",
    "Status":                   p.isApproved,
    "Doctor Commission (%)":    p.commission,
    "Rep Upline Commission (%)":p.uplineCommission,
    "Medical Rep":              p.salesRep?.name ?? "",
    "Medical Rep Email":        p.salesRep?.email ?? "",
    "Wallet Balance ($)":       p.walletBalance,
    "Total Orders":             p.ordersCount,
    "Sign-up Date":             formatDate(p.createdAt),
    "Added By":                 p.addedByRole,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Physicians");
  XLSX.writeFile(wb, `physicians-${toDateInputValue(new Date())}.xlsx`);
}

// ─── Doctor table row ─────────────────────────────────────────────────────────

function DoctorTableRow({ p }: { p: Physician }) {
  const badge = statusBadge[p.isApproved];

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-[#5BB8D4]">{p.firstName[0]}{p.lastName[0]}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{p.firstName} {p.lastName}</p>
            <p className="text-[10px] text-gray-400 truncate">{p.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-gray-500 truncate">{p.loginId || "Not set"}</td>
      <td className="px-3 py-3 text-gray-500 text-xs truncate max-w-[120px]">{p.nameOfPractice ?? "—"}</td>
      <td className="px-3 py-3">
        <span className="text-xs font-medium text-gray-700">{p.state ?? "—"}</span>
        {p.city && <p className="text-[10px] text-gray-400">{p.city}</p>}
      </td>
      <td className="px-3 py-3">
        {p.salesRep ? (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{p.salesRep.name}</p>
            <p className="text-[10px] text-gray-400 truncate">{p.salesRep.email}</p>
          </div>
        ) : (
          <span className="text-xs text-gray-300 italic">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 border rounded-full text-[10px] font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {p.isApproved === ApprovalStatus.PENDING && (
            <PhysicianApprovalActions
              physicianId={p.id}
              physicianName={` ${p.firstName} ${p.lastName}`}
              existingCommission={p.commission}
              salesRep={p.salesRep ? { firstName: p.salesRep.firstName, lastName: p.salesRep.lastName } : null}
            />
          )}
          {p.isApproved === ApprovalStatus.APPROVED && (
            <Link
              href={`/admin/order-behalf/${p.id}/shop`}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Place Order
            </Link>
          )}
          <Link
            href={`/admin/physicians/${p.id}/orders`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8] bg-[#5BB8D4]/10 hover:bg-[#5BB8D4]/20 px-2 py-1 rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Summary
          </Link>
          <Link href={`/admin/physicians/${p.id}`} className="text-xs font-medium text-gray-500 hover:text-gray-700">View</Link>
          <Link href={`/admin/physicians/${p.id}/edit`} className="text-xs font-medium text-[#5BB8D4] hover:text-[#3a9db8]">Edit</Link>
          <DeleteButton
            action={deletePhysician.bind(null, p.id)}
            modalTitle="Delete this physician?"
            modalDescription={` ${p.firstName} ${p.lastName}'s account will be permanently removed.`}
          />
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhysiciansPageClient({
  physicians,
  total,
}: {
  physicians: Physician[];
  total: number;
}) {
  const [query,       setQuery]       = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(10);

  // Unique state codes present in the data, sorted
  const stateOptions = useMemo(() => {
    const codes = [...new Set(physicians.map((p) => p.state).filter(Boolean) as string[])].sort();
    return codes;
  }, [physicians]);

  const filteredPhysicians = useMemo(() => {
    let list = physicians;

    if (stateFilter) {
      list = list.filter((p) => p.state === stateFilter);
    }

    if (query.trim()) {
      const q = query.trim();
      list = list.filter(
        (p) =>
          match(`${p.firstName} ${p.lastName}`, q) ||
          match(p.email, q) ||
          (p.loginId && match(p.loginId, q)) ||
          match(p.id, q) ||
          (p.nameOfPractice && match(p.nameOfPractice, q)) ||
          (p.salesRep && match(p.salesRep.name, q)) ||
          (p.state && match(p.state, q)) ||
          (p.city && match(p.city, q)) ||
          (p.zipCode && match(p.zipCode, q)),
      );
    }

    return list;
  }, [query, stateFilter, physicians]);

  useEffect(() => { setPage(1); }, [filteredPhysicians]);

  const pagedPhysicians = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPhysicians.slice(start, start + pageSize);
  }, [filteredPhysicians, page, pageSize]);

  const isFiltering = query.trim().length > 0 || stateFilter !== "";

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Partnering Physicians</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage doctors, downline structure, and commission rates ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportToExcel(filteredPhysicians)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Excel
          </button>
          <Link
            href="/admin/physicians/new"
            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Physician
          </Link>
        </div>
      </div>

      {/* ── Search + State filter ── */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, state, city, practice, or ID…"
            className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="h-full pl-3 pr-8 py-3 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 transition-colors appearance-none min-w-[130px]"
          >
            <option value="">All States</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isFiltering && (
        <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-900" />
            {filteredPhysicians.length} doctor{filteredPhysicians.length !== 1 ? "s" : ""}
          </span>
          {query && <span className="text-gray-300">for "{query}"</span>}
          {stateFilter && <span className="text-gray-300">in {stateFilter}</span>}
        </div>
      )}

      {/* ── Doctor List ── */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-900" />
          Partnering Doctors
          <span className="text-gray-300 font-normal normal-case tracking-normal">
            ({filteredPhysicians.length}{isFiltering ? " found" : ""})
          </span>
        </h2>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredPhysicians.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-medium text-gray-400">
                {isFiltering ? "No doctors match the current filter" : "No physicians yet"}
              </p>
              {!isFiltering && (
                <Link href="/admin/physicians/new" className="mt-2 text-sm text-[#3DBFA4] hover:underline font-medium">
                  Add your first physician
                </Link>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[22%]">Doctor</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[14%]">Login ID</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[16%]">Practice</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[8%]">State</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%]">Medical Rep</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[10%]">Status</th>
                    <th className="px-3 py-3 w-[12%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedPhysicians.map((p) => (
                    <DoctorTableRow key={p.id} p={p} />
                  ))}
                </tbody>
              </table>
              <ClientPagination
                total={filteredPhysicians.length}
                page={page}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
