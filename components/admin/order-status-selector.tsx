"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { updateOrderStatus } from "@/actions/admin/manage-orders";
import { OrderStatus } from "@/generated/prisma/enums";
import { useRouter } from "next/navigation";

const STATUSES: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"];

interface Props { orderId: string; current: OrderStatus; }

export function OrderStatusSelector({ orderId, current }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as OrderStatus;
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, status);
      if (res?.success) { toast.success("Status updated"); router.refresh(); }
      else toast.error(res?.message ?? "Failed to update status");
    });
  }

  return (
    <select value={current} onChange={onChange} disabled={pending}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors disabled:opacity-50 cursor-pointer">
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0) + s.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}

