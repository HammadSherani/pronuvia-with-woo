"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { updateUplineCommission, updateDoctorCommission } from "@/actions/admin/manage-physicians";
import type { PhysicianActionState } from "@/actions/admin/manage-physicians";

type Doctor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  nameOfPractice: string | null;
  credential: string | null;
  uplineCommission: number;
  commission: number;
  ordersCount: number;
  createdAt: Date;
};

function CommissionCell({
  initialValue,
  color,
  onSave,
}: {
  initialValue: number;
  color: "emerald" | "blue";
  onSave: (val: number) => Promise<PhysicianActionState>;
}) {
  const [value, setValue]          = useState(initialValue);
  const [saved, setSaved]          = useState(initialValue);
  const [pending, startTransition] = useTransition();

  const dirty = value !== saved;

  const ring    = color === "emerald" ? "focus:ring-gray-900/40 focus:border-gray-900" : "focus:ring-blue-300/40 focus:border-blue-400";
  const btnBg   = color === "emerald" ? "bg-gray-900 hover:bg-gray-700" : "bg-blue-500 hover:bg-blue-600";

  function handleSave() {
    startTransition(async () => {
      const result = await onSave(value);
      if (result?.success) {
        setSaved(value);
        toast.success(result.message ?? "Updated");
      } else {
        toast.error(result?.message ?? "Failed to update");
        setValue(saved);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
          disabled={pending}
          className={`w-20 px-2.5 py-1.5 pr-6 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors ${ring}`}
        />
        <span className="absolute right-2 text-xs text-gray-400 pointer-events-none">%</span>
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          disabled={pending}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-medium rounded-lg disabled:opacity-60 transition-colors ${btnBg}`}
        >
          {pending ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          Save
        </button>
      )}
    </div>
  );
}

export function DownlineTable({ doctors }: { doctors: Doctor[] }) {
  if (doctors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No physicians assigned yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="pb-3 text-left text-xs font-medium text-gray-400 pr-4">Physician</th>
            <th className="pb-3 text-left text-xs font-medium text-gray-400 pr-4">Practice</th>
            <th className="pb-3 text-left text-xs font-medium text-gray-400 pr-4">
              <span className="inline-flex items-center gap-1">
                Doctor Commission
                <span className="text-gray-300 font-normal">(what doctor earns)</span>
              </span>
            </th>
            <th className="pb-3 text-left text-xs font-medium text-gray-400 pr-4">
              <span className="inline-flex items-center gap-1">
                Upline Commission
                <span className="text-gray-300 font-normal">(what rep earns)</span>
              </span>
            </th>
            <th className="pb-3 text-right text-xs font-medium text-gray-400">Orders</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {doctors.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50/40 transition-colors">
              {/* Name */}
              <td className="py-3.5 pr-4">
                <Link href={`/admin/physicians/${doc.id}`} className="group flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-violet-500">
                      {doc.firstName[0]}{doc.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 group-hover:text-[#3DBFA4] transition-colors leading-tight">
                       {doc.firstName} {doc.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{doc.email}</p>
                  </div>
                </Link>
              </td>

              {/* Practice */}
              <td className="py-3.5 pr-4 text-gray-600">
                {doc.nameOfPractice || <span className="text-gray-300">—</span>}
                {doc.credential && <span className="text-gray-400"> · {doc.credential}</span>}
              </td>

              {/* Doctor commission — editable */}
              <td className="py-3.5 pr-4">
                <CommissionCell
                  initialValue={doc.commission}
                  color="emerald"
                  onSave={(val) => updateDoctorCommission(doc.id, val)}
                />
              </td>

              {/* Upline commission — editable */}
              <td className="py-3.5 pr-4">
                <CommissionCell
                  initialValue={doc.uplineCommission}
                  color="blue"
                  onSave={(val) => updateUplineCommission(doc.id, val)}
                />
              </td>

              {/* Orders */}
              <td className="py-3.5 text-right font-medium text-gray-600">
                {doc.ordersCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
