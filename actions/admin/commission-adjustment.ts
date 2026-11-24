"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { addCommissionAdjustment, removeCommissionAdjustment } from "@/lib/commission/adjustments";
import { periodLabel, periodKeyOf, type PayoutRole } from "@/lib/commission/lines";

export type AdjustableOrder = {
  id: string; orderNumber: string; createdAt: string; period: string; status: string; commission: number;
};

/** The user's orders that carry commission for them, newest first (for the order picker). */
export async function listAdjustableOrders(userId: string, userRole: PayoutRole, search = ""): Promise<AdjustableOrder[]> {
  await requireAdmin();
  const q = search.trim().replace(/^#/, "");
  const orders = await prisma.order.findMany({
    where: {
      ...(userRole === "PHYSICIAN" ? { physicianId: userId } : { salesRepId: userId }),
      ...(q && { orderNumber: { contains: q } }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, orderNumber: true, createdAt: true, status: true, physicianCommissionAmount: true, salesRepCommissionAmount: true },
  });
  return orders.map((o) => ({
    id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt.toISOString(),
    period: periodLabel(periodKeyOf(o.createdAt)), status: o.status,
    commission: userRole === "PHYSICIAN" ? o.physicianCommissionAmount : o.salesRepCommissionAmount,
  }));
}

export async function createCommissionAdjustment(input: {
  userId: string; userRole: PayoutRole; orderId: string; amount: number; reason: string;
}): Promise<{ success: boolean; message: string }> {
  const session = await requireAdmin();
  const admin = await prisma.admin.findUnique({ where: { id: session.userId }, select: { email: true } });
  try {
    const r = await addCommissionAdjustment({ ...input, by: admin?.email ?? "Admin" });
    revalidatePath("/admin/wallet-adjustment");
    revalidatePath("/admin/withdrawals");
    const sign = input.amount > 0 ? "+" : "−";
    return { success: true, message: `Adjustment ${sign}$${Math.abs(input.amount).toFixed(2)} added to the ${periodLabel(r.periodKey)} payout.` };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Could not add the adjustment." };
  }
}

export async function deleteCommissionAdjustment(lineId: string): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  const ok = await removeCommissionAdjustment(lineId);
  revalidatePath("/admin/wallet-adjustment");
  revalidatePath("/admin/withdrawals");
  return ok ? { success: true, message: "Adjustment removed." } : { success: false, message: "Only an adjustment that is not paid yet can be removed." };
}
