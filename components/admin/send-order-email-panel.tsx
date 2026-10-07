"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { sendOrderEmail, type OrderEmailType } from "@/actions/admin/manage-orders";

const EMAIL_OPTIONS: { value: OrderEmailType; label: string }[] = [
  { value: "new_order",       label: "New Order" },
  { value: "cancelled_order", label: "Cancelled Order" },
  { value: "processing_order",label: "Processing Order" },
  { value: "completed_order", label: "Completed Order" },
  { value: "order_details",   label: "Order Details" },
];

export function SendOrderEmailPanel({ orderId }: { orderId: string }) {
  const [emailType, setEmailType] = useState<OrderEmailType | "">("");
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (!emailType) { toast.error("Please choose an email to send."); return; }
    startTransition(async () => {
      const res = await sendOrderEmail(orderId, emailType as OrderEmailType);
      if (res.success) toast.success(res.message);
      else             toast.error(res.message);
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Send order email</h3>
      </div>
      <div className="p-4 space-y-3">
        <select
          value={emailType}
          onChange={(e) => setEmailType(e.target.value as OrderEmailType)}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 bg-white text-gray-700"
        >
          <option value="">Choose an email to send...</option>
          {EMAIL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !emailType}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {isPending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>}
          Save order &amp; send email
        </button>
      </div>
    </div>
  );
}
