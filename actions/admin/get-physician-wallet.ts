"use server";

import { prisma }       from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";

export async function getPhysicianWalletDetails(physicianId: string) {
  await requireAdmin();

  const [physician, transactions, withdrawRequests] = await Promise.all([
    prisma.partneringPhysician.findUnique({
      where:  { id: physicianId },
      select: {
        firstName: true, lastName: true, email: true,
        walletBalance: true,
        bankName: true, bankAccountNumber: true, bankAccountName: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where:   { userId: physicianId, userRole: "PHYSICIAN" },
      orderBy: { createdAt: "desc" },
      take:    30,
    }),
    prisma.withdrawRequest.findMany({
      where:   { userId: physicianId, userRole: "PHYSICIAN" },
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  { id: true, amount: true, status: true, createdAt: true, note: true, adminNote: true },
    }),
  ]);

  return { physician, transactions, withdrawRequests };
}
