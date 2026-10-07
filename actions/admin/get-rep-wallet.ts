"use server";

import { prisma }       from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";

export async function getRepWalletDetails(salesRepId: string) {
  await requireAdmin();

  const [rep, transactions, withdrawRequests] = await Promise.all([
    prisma.salesRepresentative.findUnique({
      where:  { id: salesRepId },
      select: {
        firstName: true, lastName: true, email: true,
        walletBalance: true,
        bankName: true, bankAccountNumber: true, bankAccountName: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where:   { userId: salesRepId, userRole: "SALES_REP" },
      orderBy: { createdAt: "desc" },
      take:    30,
    }),
    prisma.withdrawRequest.findMany({
      where:   { userId: salesRepId, userRole: "SALES_REP" },
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  { id: true, amount: true, status: true, createdAt: true, note: true, adminNote: true },
    }),
  ]);

  return { rep, transactions, withdrawRequests };
}
