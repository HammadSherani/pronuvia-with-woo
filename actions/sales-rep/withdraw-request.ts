"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSalesRep } from "@/lib/auth/dal";

export type WithdrawState = {
  success?: boolean;
  message?: string;
} | undefined;

export async function createWithdrawRequest(
  _state: WithdrawState,
  formData: FormData,
): Promise<WithdrawState> {
  const session = await requireSalesRep();

  const amount = parseFloat((formData.get("amount") as string) || "0");
  const note   = ((formData.get("note") as string) || "").trim() || undefined;

  if (isNaN(amount) || amount < 10) {
    return { success: false, message: "Minimum withdrawal amount is $10." };
  }

  const rep = await prisma.salesRepresentative.findUnique({
    where:  { id: session.userId },
    select: { walletBalance: true },
  });

  if (!rep) return { success: false, message: "Account not found." };

  if (amount > rep.walletBalance) {
    return {
      success: false,
      message: `Insufficient balance. Available: $${rep.walletBalance.toFixed(2)}.`,
    };
  }

  // Block if there's already a pending request
  const existing = await prisma.withdrawRequest.findFirst({
    where:  { userId: session.userId, userRole: "SALES_REP", status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      message: "You already have a pending withdrawal request. Please wait for it to be processed.",
    };
  }

  await prisma.withdrawRequest.create({
    data: { userId: session.userId, userRole: "SALES_REP", amount, note },
  });

  revalidatePath("/sales/wallet");
  return { success: true, message: `Withdrawal request of $${amount.toFixed(2)} submitted successfully.` };
}
