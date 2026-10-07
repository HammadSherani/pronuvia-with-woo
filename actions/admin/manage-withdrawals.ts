"use server";

import { revalidatePath }                          from "next/cache";
import { prisma }                                  from "@/lib/db/prisma";
import { requireAdmin }                            from "@/lib/auth/dal";
import { sendPayoutApprovalEmail, type ApprovedPayoutRequest } from "@/lib/withdrawals/notifications";

export type WithdrawalActionState = {
  success?: boolean;
  message?: string;
} | undefined;

async function applyWithdrawDecision(
  requestId: string,
  action: "APPROVED" | "REJECTED",
  adminNote: string | undefined,
  description: string,
): Promise<ApprovedPayoutRequest | null> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.withdrawRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true, status: true, amount: true, userId: true, userRole: true,
        note: true, createdAt: true, snapshotAt: true,
      },
    });

    if (!request || request.status !== "PENDING") return null;
    if (action === "APPROVED" && request.amount <= 0) {
      throw new Error("Payout amount must be greater than zero.");
    }

    // Claim the request first. A second admin click can no longer deduct the
    // wallet or send a second email once this conditional update succeeds.
    const claimed = await tx.withdrawRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: action,
        adminNote: adminNote?.trim() || null,
        ...(action === "APPROVED"
          ? {
              notificationStatus: "PENDING",
              notificationAttempts: 0,
              notificationLastAttemptAt: null,
              notificationLastError: null,
            }
          : {}),
      },
    });
    if (claimed.count !== 1) return null;

    if (action === "APPROVED") {
      if (request.userRole === "SALES_REP") {
        const rep = await tx.salesRepresentative.findUnique({
          where: { id: request.userId },
          select: { walletBalance: true, bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true },
        });
        if (!rep?.bankName || !rep.bankAccountNumber || !rep.bankAccountName || !rep.bankAccountType || !rep.bankOwnershipType) {
          throw new Error("User has incomplete bank account details.");
        }
        const updated = await tx.salesRepresentative.updateMany({
          where: { id: request.userId, walletBalance: { gte: request.amount } },
          data: { walletBalance: { decrement: request.amount } },
        });
        if (updated.count !== 1) throw new Error("Wallet balance is lower than the payout amount.");
        const after = await tx.salesRepresentative.findUnique({ where: { id: request.userId }, select: { walletBalance: true } });
        await tx.walletTransaction.create({
          data: { userId: request.userId, userRole: request.userRole, amount: request.amount, type: "DEBIT", description, balance: after?.walletBalance ?? 0 },
        });
      } else {
        const physician = await tx.partneringPhysician.findUnique({
          where: { id: request.userId },
          select: { walletBalance: true, bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true },
        });
        if (!physician?.bankName || !physician.bankAccountNumber || !physician.bankAccountName || !physician.bankAccountType || !physician.bankOwnershipType) {
          throw new Error("User has incomplete bank account details.");
        }
        const updated = await tx.partneringPhysician.updateMany({
          where: { id: request.userId, walletBalance: { gte: request.amount } },
          data: { walletBalance: { decrement: request.amount } },
        });
        if (updated.count !== 1) throw new Error("Wallet balance is lower than the payout amount.");
        const after = await tx.partneringPhysician.findUnique({ where: { id: request.userId }, select: { walletBalance: true } });
        await tx.walletTransaction.create({
          data: { userId: request.userId, userRole: request.userRole, amount: request.amount, type: "DEBIT", description, balance: after?.walletBalance ?? 0 },
        });
      }
    }

    return {
      id: request.id,
      amount: request.amount,
      userId: request.userId,
      userRole: request.userRole,
      note: request.note,
      createdAt: request.createdAt,
      snapshotAt: request.snapshotAt,
    };
  });
}

export async function updateWithdrawRequest(
  requestId: string,
  action:    "APPROVED" | "REJECTED",
  adminNote?: string,
): Promise<WithdrawalActionState> {
  await requireAdmin();

  let request: ApprovedPayoutRequest | null;
  try {
    request = await applyWithdrawDecision(requestId, action, adminNote, "Paid Commission");
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to update payout request." };
  }

  if (!request) return { success: false, message: "Request not found or already processed." };

  revalidatePath("/admin/withdrawals");
  revalidatePath("/admin/payout-requests");
  revalidatePath("/sales/wallet");
  revalidatePath("/physician/wallet");

  if (action === "APPROVED") {
    try {
      await sendPayoutApprovalEmail(request);
    } catch (error) {
      console.error("[payout-email] failed:", error);
      return {
        success: true,
        message: "Request approved, but the notification email failed. Check email configuration and retry the notification.",
      };
    }
  }

  return { success: true, message: `Request ${action.toLowerCase()} successfully.` };
}

export async function deleteWithdrawRequest(
  requestId: string,
): Promise<WithdrawalActionState> {
  await requireAdmin();
  const req = await prisma.withdrawRequest.findUnique({ where: { id: requestId }, select: { status: true } });
  if (!req)                     return { success: false, message: "Request not found." };
  if (req.status !== "PENDING") return { success: false, message: "Only pending requests can be deleted." };
  await prisma.withdrawRequest.delete({ where: { id: requestId } });
  revalidatePath("/admin/payout-requests");
  return { success: true, message: "Request removed." };
}

export async function bulkUpdateWithdrawals(
  ids:    string[],
  action: "APPROVED" | "REJECTED",
): Promise<{ success: boolean; processed: number; failed: number; message: string }> {
  await requireAdmin();

  if (!ids.length) return { success: false, processed: 0, failed: 0, message: "No IDs provided." };

  let processed = 0;
  let failed    = 0;
  let notificationFailures = 0;

  for (const id of ids) {
    try {
      const request = await applyWithdrawDecision(id, action, undefined, "Paid Commission");
      if (!request) { failed++; continue; }

      if (action === "APPROVED") {
        try {
          await sendPayoutApprovalEmail(request);
        } catch (error) {
          notificationFailures++;
          console.error(`[payout-email] bulk notification failed for ${id}:`, error);
        }
      }
      processed++;
    } catch (error) {
      failed++;
      console.error(`[payout] bulk request ${id} failed:`, error);
    }
  }

  revalidatePath("/admin/withdrawals");
  revalidatePath("/sales/wallet");
  revalidatePath("/physician/wallet");

  const verb = action === "APPROVED" ? "approved" : "rejected";
  const notificationMessage = notificationFailures > 0
    ? ` ${notificationFailures} notification${notificationFailures !== 1 ? "s" : ""} failed.`
    : "";
  return {
    success:   processed > 0,
    processed,
    failed,
    message:   failed > 0
      ? `${processed} ${verb}, ${failed} skipped (already processed).${notificationMessage}`
      : `${processed} request${processed !== 1 ? "s" : ""} ${verb} successfully.${notificationMessage}`,
  };
}
