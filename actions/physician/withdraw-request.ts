"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePhysician } from "@/lib/auth/dal";

export type PhysicianWithdrawState = {
  success?: boolean;
  message?: string;
} | undefined;

export async function createPhysicianWithdrawRequest(
  _state: PhysicianWithdrawState,
  formData: FormData,
): Promise<PhysicianWithdrawState> {
  const session = await requirePhysician();

  const amount = parseFloat((formData.get("amount") as string) || "0");
  const note   = ((formData.get("note") as string) || "").trim() || undefined;

  if (isNaN(amount) || amount < 10) {
    return { success: false, message: "Minimum withdrawal amount is $10." };
  }

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: session.userId },
    select: { walletBalance: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
  });

  if (!physician) return { success: false, message: "Account not found." };

  if (!physician.bankName || !physician.bankAccountNumber || !physician.bankAccountName) {
    return { success: false, message: "Complete your bank details in Account Settings first." };
  }

  if (amount > physician.walletBalance) {
    return {
      success: false,
      message: `Insufficient balance. Available: $${physician.walletBalance.toFixed(2)}.`,
    };
  }

  const existing = await prisma.withdrawRequest.findFirst({
    where:  { userId: session.userId, userRole: "PHYSICIAN", status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      message: "You already have a pending withdrawal request. Please wait for it to be processed.",
    };
  }

  await prisma.withdrawRequest.create({
    data: { userId: session.userId, userRole: "PHYSICIAN", amount, note },
  });

  revalidatePath("/physician/wallet");
  revalidatePath("/physician/withdrawals");
  return { success: true, message: `Withdrawal request of $${amount.toFixed(2)} submitted successfully.` };
}
