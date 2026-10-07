"use server";

import { revalidatePath }             from "next/cache";
import { prisma }                      from "@/lib/db/prisma";
import { requireAdmin }                from "@/lib/auth/dal";
import { syncPendingPayoutRequest }     from "@/lib/withdrawals/sync";
import type { Role }                   from "@/generated/prisma/enums";

export async function adjustWallet(data: {
  userId:   string;
  userRole: "SALES_REP" | "PHYSICIAN";
  type:     "CREDIT" | "DEBIT";
  amount:   number;
  note:     string;
}): Promise<{ success: boolean; message: string }> {
  const session = await requireAdmin();

  const { userId, userRole, type, amount, note } = data;

  if (!amount || amount <= 0) return { success: false, message: "Amount must be greater than 0." };
  if (!note.trim())           return { success: false, message: "Note is required." };

  let newBalance: number;

  if (userRole === "SALES_REP") {
    const rep = await prisma.salesRepresentative.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    if (!rep) return { success: false, message: "Sales rep not found." };
    newBalance = type === "CREDIT" ? (rep.walletBalance ?? 0) + amount : (rep.walletBalance ?? 0) - amount;
    await prisma.salesRepresentative.update({ where: { id: userId }, data: { walletBalance: newBalance } });
    revalidatePath("/sales/wallet");
  } else {
    const physician = await prisma.partneringPhysician.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    if (!physician) return { success: false, message: "Physician not found." };
    newBalance = type === "CREDIT" ? (physician.walletBalance ?? 0) + amount : (physician.walletBalance ?? 0) - amount;
    await prisma.partneringPhysician.update({ where: { id: userId }, data: { walletBalance: newBalance } });
    revalidatePath("/physician/wallet");
  }

  await prisma.walletTransaction.create({
    data: { userId, userRole, amount, type, description: `Admin [${session.email}]: ${note.trim()}`, balance: newBalance },
  });

  await syncPendingPayoutRequest(userId, userRole as Role, newBalance);

  revalidatePath("/admin/wallet-adjustment");
  revalidatePath("/admin/payout-requests");

  const verb = type === "CREDIT" ? "added to" : "deducted from";
  return { success: true, message: `$${amount.toFixed(2)} ${verb} wallet. New balance: $${newBalance.toFixed(2)}.` };
}
