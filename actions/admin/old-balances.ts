"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { rebuildPayoutRequests, settledKey, type PayoutRole } from "@/lib/commission/lines";

// "Needs review" on Commission Payout: old-site commission dated on or before
// 12/31/2025, which the admin checks one by one. "Pay" sends a line to the
// payout of its month (then paid like any other); "Cancel" drops it for good.

type Result = { success: boolean; message: string };

async function reviewLines(lineIds: string[]) {
  return prisma.commissionLine.findMany({
    where:  { id: { in: lineIds }, status: "NEEDS_REVIEW" },
    select: { id: true, userId: true, userRole: true, amount: true },
  });
}

function revalidate() {
  revalidatePath("/admin/withdrawals");
  revalidatePath("/physician/wallet");
  revalidatePath("/sales/wallet");
}

export async function payOldBalances(lineIds: string[]): Promise<Result> {
  await requireAdmin();
  const lines = await reviewLines(lineIds);
  if (!lines.length) return { success: false, message: "Nothing to move: these lines were already reviewed." };
  await prisma.commissionLine.updateMany({ where: { id: { in: lines.map((l) => l.id) }, status: "NEEDS_REVIEW" }, data: { status: "PENDING" } });
  const users = new Map(lines.map((l) => [`${l.userId}:${l.userRole}`, l]));
  for (const l of users.values()) await rebuildPayoutRequests(l.userId, l.userRole as PayoutRole);
  revalidate();
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { success: true, message: `${lines.length} line${lines.length !== 1 ? "s" : ""} ($${total.toFixed(2)}) moved to Commission Payout.` };
}

export async function cancelOldBalances(lineIds: string[], reason: string): Promise<Result> {
  await requireAdmin();
  const why = reason.trim();
  if (!why) return { success: false, message: "Enter why this commission is cancelled." };
  const lines = await reviewLines(lineIds);
  if (!lines.length) return { success: false, message: "Nothing to cancel: these lines were already reviewed." };
  const now = new Date();
  for (const l of lines) {
    await prisma.commissionLine.updateMany({
      where: { id: l.id, status: "NEEDS_REVIEW" },
      data:  { status: "CANCELLED", cancelledAt: now, note: why.slice(0, 500), key: settledKey("cancelled", l.id) },
    });
  }
  revalidate();
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { success: true, message: `${lines.length} line${lines.length !== 1 ? "s" : ""} ($${total.toFixed(2)}) cancelled.` };
}
