"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { getAllSalesRepsForExport } from "@/actions/admin/manage-sales-reps";
import { formatDate, toDateInputValue } from "@/lib/utils/timezone";

export function SalesRepsExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const reps = await getAllSalesRepsForExport();
      const rows = reps.map((r) => ({
        "First Name":          r.firstName,
        "Last Name":           r.lastName,
        "Email":               r.email,
        "Login ID":            r.loginId ?? "",
        "Phone":               r.phone ?? "",
        "Commission (%)":      r.commission,
        "Total Orders":        r.ordersCount,
        "Wallet Balance ($)":  r.walletBalance,
        "Billing Address":     r.billingAddress ?? "",
        "Shipping Address":    r.shippingAddress ?? "",
        "Bank Name":           r.bankName ?? "",
        "Bank Account #":      r.bankAccountNumber ?? "",
        "Bank Account Name":   r.bankAccountName ?? "",
        "Swift Code":          r.swiftCode ?? "",
        "Routing Number":      r.routingNumber ?? "",
        "Doctors":             r.physicians
          .map((p) => [
            `${p.firstName} ${p.lastName}`,
            p.email,
            p.nameOfPractice ?? "",
            p.state ?? "",
          ].filter(Boolean).join(" | "))
          .join("; "),
        "Sign-up Date":        formatDate(r.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Medical Reps");
      XLSX.writeFile(wb, `medical-reps-${toDateInputValue(new Date())}.xlsx`);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {loading ? "Exporting…" : "Export Excel"}
    </button>
  );
}
