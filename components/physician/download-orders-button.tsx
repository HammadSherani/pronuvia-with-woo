"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { getPhysicianOrdersForExport } from "@/actions/physician/export-orders";
import { toDateInputValue } from "@/lib/utils/timezone";

export function DownloadOrdersButton() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const rows = await getPhysicianOrdersForExport();

      const sheetData = [
        [
          "Order Number",
          "Date",
          "Order Status",
          "Payment Status",
          "Payment Method",
          "Billing Name",
          "Billing Address",
          "Shipping Name",
          "Shipping Address",
          "Items Ordered",
          "Subtotal ($)",
          "Shipping Cost ($)",
          "Total ($)",
          "Carrier",
          "Tracking Number",
        ],
        ...rows.map((r) => [
          r.orderNumber,
          r.date,
          r.status,
          r.paymentStatus,
          r.paymentMethod,
          r.billingName,
          r.billingAddress,
          r.shippingName,
          r.shippingAddress,
          r.items,
          r.subtotal,
          r.shippingCost,
          r.total,
          r.carrier,
          r.trackingNumber,
        ]),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      ws["!cols"] = [
        { wch: 22 }, // Order Number
        { wch: 14 }, // Date
        { wch: 14 }, // Order Status
        { wch: 14 }, // Payment Status
        { wch: 14 }, // Payment Method
        { wch: 24 }, // Billing Name
        { wch: 36 }, // Billing Address
        { wch: 24 }, // Shipping Name
        { wch: 36 }, // Shipping Address
        { wch: 48 }, // Items
        { wch: 12 }, // Subtotal
        { wch: 14 }, // Shipping Cost
        { wch: 12 }, // Total
        { wch: 18 }, // Carrier
        { wch: 24 }, // Tracking Number
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Orders");

      const today = toDateInputValue(new Date());
      XLSX.writeFile(wb, `pronuvia-orders-${today}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-gray-300 border-t-[#3DBFA4] rounded-full animate-spin" />
          Exporting…
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download XLS
        </>
      )}
    </button>
  );
}
