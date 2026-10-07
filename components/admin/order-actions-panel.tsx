"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { OrderStatus } from "@/generated/prisma/enums";
import { updateOrderStatus, deleteOrder } from "@/actions/admin/manage-orders";

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "PENDING",    label: "Pending payment" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED",    label: "Shipped" },
  { value: "DELIVERED",  label: "Delivered" },
  { value: "COMPLETED",  label: "Completed" },
  { value: "CANCELLED",  label: "Cancelled" },
  { value: "REFUNDED",   label: "Refunded" },
];

export function OrderActionsPanel({
  orderId,
  current,
  isReturned,
}: {
  orderId:   string;
  current:   OrderStatus;
  isReturned: boolean;
}) {
  const router = useRouter();
  const [status,         setStatus]         = useState<OrderStatus>(current);
  const [confirmDelete,  setConfirmDelete]   = useState(false);
  const [isPending,      startTransition]    = useTransition();
  const [isDeleting,     startDelete]        = useTransition();

  const handleUpdate = () => {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, status);
      if (res?.success) toast.success(res.message ?? "Status updated.");
      else              toast.error(res?.message ?? "Failed.");
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const res = await deleteOrder(orderId);
      if (res?.success) {
        toast.success("Order deleted.");
        router.push("/admin/orders");
      } else {
        toast.error(res?.message ?? "Failed.");
        setConfirmDelete(false);
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Order actions</h3>
      </div>
      <div className="p-4 space-y-4">
        {!isReturned && (
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/40 focus:border-gray-900 bg-white text-gray-700"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isPending}
              className="shrink-0 flex items-center justify-center w-[72px] py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isPending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Update"}
            </button>
          </div>
        )}

        <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
          {confirmDelete ? (
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-gray-500 flex-1">Delete this order?</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {isDeleting ? "..." : "Confirm"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm hidden text-red-500 hover:text-red-700 font-medium hover:underline transition-colors"
            >
              Move to Trash
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
