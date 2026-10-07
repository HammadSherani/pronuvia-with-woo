"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalesRep } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const WithdrawSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .transform((v) => parseFloat(v))
    .refine((v) => !isNaN(v) && v > 0, "Amount must be a positive number"),
  note: z.string().max(500).optional(),
});

export type WithdrawState = {
  errors?: { amount?: string[]; note?: string[] };
  message?: string;
  success?: boolean;
} | undefined;

export async function createWithdrawRequest(
  _state: WithdrawState,
  formData: FormData
): Promise<WithdrawState> {
  const session = await requireSalesRep();

  const raw = {
    amount: formData.get("amount"),
    note:   formData.get("note") || undefined,
  };

  const validated = WithdrawSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { amount, note } = validated.data;

  try {
    const rep = await prisma.salesRepresentative.findUnique({
      where:  { id: session.userId },
      select: { walletBalance: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
    });

    if (!rep) return { message: "Account not found." };
    if (!rep.bankName || !rep.bankAccountNumber || !rep.bankAccountName) {
      return { message: "Please complete your bank details in Account Settings before requesting a withdrawal." };
    }
    if (amount > rep.walletBalance) {
      return {
        errors: {
          amount: [`Requested amount exceeds your wallet balance of $${rep.walletBalance.toFixed(2)}.`],
        },
      };
    }

    const pending = await prisma.withdrawRequest.findFirst({
      where: { userId: session.userId, userRole: "SALES_REP", status: "PENDING" },
    });
    if (pending) {
      return { message: "You already have a pending withdrawal request. Please wait for it to be processed." };
    }

    await prisma.withdrawRequest.create({
      data: { userId: session.userId, userRole: "SALES_REP", amount, note: note ?? null },
    });

    revalidatePath("/sales/withdrawals");
    revalidatePath("/sales/wallet");
    revalidatePath("/admin/withdrawals");
  } catch (err) {
    console.error("[createWithdrawRequest]", err);
    return { message: "Failed to submit request. Please try again." };
  }

  redirect("/sales/withdrawals");
}
