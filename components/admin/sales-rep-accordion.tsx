"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CommissionEditor } from "@/components/admin/commission-editor";
import { updateSalesRepCommission } from "@/actions/admin/manage-sales-reps";
import { updateUplineCommission, updateDoctorCommission } from "@/actions/admin/manage-physicians";

function matchStr(text: string, q: string) {
  return text.toLowerCase().includes(q.toLowerCase());
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Physician = {
  id: string; firstName: string; lastName: string;
  email: string; nameOfPractice: string | null;
  commission: number; uplineCommission: number;
};

type SalesRep = {
  id: string; firstName: string; lastName: string;
  email: string; phone: string | null;
  commission: number; walletBalance: number | null;
  physicians: Physician[];
};

// ─── Doctor row ───────────────────────────────────────────────────────────────

function DoctorRow({ doctor }: { doctor: Physician }) {
  const handleUpline = async (v: number) => {
    const res = await updateUplineCommission(doctor.id, v);
    if (res?.success) toast.success("Rep commission updated");
    else toast.error(res?.message ?? "Failed");
  };
  const handleOwn = async (v: number) => {
    const res = await updateDoctorCommission(doctor.id, v);
    if (res?.success) toast.success("Doctor commission updated");
    else toast.error(res?.message ?? "Failed");
  };

  return (
    <tr className="hover:bg-gray-900/[0.02] transition-colors">
      <td className="pl-16 pr-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#5BB8D4]">
              {doctor.firstName[0]}{doctor.lastName[0]}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800"> {doctor.firstName} {doctor.lastName}</p>
            <p className="text-[10px] text-gray-400">{doctor.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[10px] text-gray-500">{doctor.nameOfPractice ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-400 leading-none">Rep gets</span>
          <CommissionEditor value={doctor.uplineCommission} label="rep commission for this doctor" onSave={handleUpline} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-400 leading-none">Doctor gets</span>
          <CommissionEditor value={doctor.commission} label="doctor's own commission" onSave={handleOwn} badgeColor="blue" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/admin/physicians/${doctor.id}`} className="text-[10px] font-medium text-gray-400 hover:text-gray-700">View</Link>
          <Link href={`/admin/physicians/${doctor.id}/edit`} className="text-[10px] font-medium text-[#5BB8D4] hover:text-[#3a9db8]">Edit</Link>
        </div>
      </td>
    </tr>
  );
}

// ─── Sales Rep accordion row ──────────────────────────────────────────────────

function SalesRepRow({ rep, searchQuery }: { rep: SalesRep; searchQuery: string }) {
  const hasMatchingDoctors = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.trim();
    return rep.physicians.some(
      (p) =>
        matchStr(`${p.firstName} ${p.lastName}`, q) ||
        matchStr(p.email, q) ||
        (p.nameOfPractice ? matchStr(p.nameOfPractice, q) : false),
    );
  }, [searchQuery, rep.physicians]);

  const [open, setOpen] = useState(false);
  useEffect(() => { if (hasMatchingDoctors) setOpen(true); }, [hasMatchingDoctors]);

  const handleRepCommission = async (v: number) => {
    const res = await updateSalesRepCommission(rep.id, v);
    if (res?.success) toast.success("Commission updated");
    else toast.error(res?.message ?? "Failed");
  };

  return (
    <>
      <tr
        className={`cursor-pointer select-none transition-colors ${open ? "bg-gray-900/5" : "hover:bg-gray-50/60"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <svg
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-[#3DBFA4]">{rep.firstName[0]}{rep.lastName[0]}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{rep.firstName} {rep.lastName}</p>
              <p className="text-xs text-gray-400">{rep.email}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-4 text-xs text-gray-500">{rep.phone ?? "—"}</td>
        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <CommissionEditor value={rep.commission} label="sales rep commission" onSave={handleRepCommission} />
        </td>
        <td className="px-5 py-4">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            rep.physicians.length > 0 ? "bg-gray-900/10 text-[#5BB8D4] border-[#5BB8D4]/20" : "bg-gray-50 text-gray-400 border-gray-200"
          }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {rep.physicians.length} doctor{rep.physicians.length !== 1 ? "s" : ""}
          </span>
        </td>
        <td className="px-5 py-4">
          <span className={`text-sm font-bold ${(rep.walletBalance ?? 0) > 0 ? "text-emerald-600" : "text-gray-400"}`}>
            {(rep.walletBalance ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </span>
        </td>
        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 justify-end">
            <Link href={`/admin/sales-reps/${rep.id}`} className="text-xs font-medium text-gray-500 hover:text-gray-700">View</Link>
            <Link href={`/admin/sales-reps/${rep.id}/edit`} className="text-xs font-medium text-[#3DBFA4] hover:text-[#35ab93]">Edit</Link>
          </div>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={6} className="p-0 bg-gray-900/[0.03]">
            {rep.physicians.length === 0 ? (
              <div className="pl-16 pr-5 py-4 text-xs text-gray-400 italic border-t border-gray-900/10">
                No downline doctors assigned to this sales rep yet.
              </div>
            ) : (
              <table className="w-full border-t border-gray-900/10">
                <thead>
                  <tr className="bg-gray-900/[0.06]">
                    <th className="text-left pl-16 pr-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Doctor</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Practice</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rep Commission</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Doctor Commission</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3DBFA4]/10">
                  {rep.physicians.map((doc) => (
                    <DoctorRow key={doc.id} doctor={doc} />
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SalesRepAccordionList({
  salesReps,
  searchQuery = "",
}: {
  salesReps:    SalesRep[];
  searchQuery?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {salesReps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14">
          <p className="text-sm text-gray-400">
            {searchQuery ? `No sales reps match "${searchQuery}"` : "No sales representatives yet"}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Medical Representative</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission %</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Downline</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Wallet</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {salesReps.map((rep) => (
              <SalesRepRow key={rep.id} rep={rep} searchQuery={searchQuery} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
