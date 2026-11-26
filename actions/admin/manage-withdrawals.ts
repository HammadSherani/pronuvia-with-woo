"use server";

import { revalidatePath }                          from "next/cache";
import { prisma }                                  from "@/lib/db/prisma";
import { requireAdmin }                            from "@/lib/auth/dal";
import { sendPayoutApprovalEmail, type ApprovedPayoutRequest } from "@/lib/withdrawals/notifications";
import { markCommissionPaidOutInWoo }            from "@/lib/orders/commission-paid";
import { approvePayout, rejectPayout, type DecidedPayout } from "@/lib/commission/payout";
import { payoutsLocked, payoutsLockedFor, payoutTestAccounts, PAYOUTS_LOCKED_MESSAGE } from "@/lib/withdrawals/lock";

export type WithdrawalActionState = {
  success?: boolean;
  message?: string;
} | undefined;

/** The email of the doctor / rep a payout request is for. */
async function requestUserEmail(requestId: string): Promise<string | null> {
  const r = await prisma.withdrawRequest.findUnique({ where: { id: requestId }, select: { userId: true, userRole: true } });
  if (!r) return null;
  const u = r.userRole === "PHYSICIAN"
    ? await prisma.partneringPhysician.findUnique({ where: { id: r.userId }, select: { email: true } })
    : await prisma.salesRepresentative.findUnique({ where: { id: r.userId }, select: { email: true } });
  return u?.email ?? null;
}

// Pays (approve) or turns down (reject) one payout request through its
// commission lines (lib/commission/payout). Locked while PAYOUTS_LOCKED is on.
async function applyWithdrawDecision(
  requestId: string,
  action: "APPROVED" | "REJECTED",
  adminNote: string | undefined,
  expectedAmount?: number,
): Promise<DecidedPayout | null> {
  // Checked here so every way of approving (single, bulk, detail page) is
  // covered; a test account (PAYOUTS_TEST_ACCOUNTS) stays open
  if (action === "APPROVED" && payoutsLocked() && payoutsLockedFor(await requestUserEmail(requestId))) throw new Error(PAYOUTS_LOCKED_MESSAGE);
  const result = action === "APPROVED"
    ? await approvePayout(requestId, { adminNote, expectedAmount })
    : await rejectPayout(requestId, { adminNote });
  // Tell the WP Commissions box (best effort: Pronuvia ignores changes to paid-out commission anyway)
  if (result?.paidOutOrderIds.length) await markCommissionPaidOutInWoo(result.paidOutOrderIds);
  return result;
}

export async function updateWithdrawRequest(
  requestId: string,
  action:    "APPROVED" | "REJECTED",
  adminNote?: string,
  /** The amount the admin saw: the payout is refused if it changed since */
  expectedAmount?: number,
): Promise<WithdrawalActionState> {
  await requireAdmin();

  let request: ApprovedPayoutRequest | null;
  try {
    request = await applyWithdrawDecision(requestId, action, adminNote, expectedAmount);
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
  /** The amounts the admin saw, by request id */
  expected?: Record<string, number>,
): Promise<{ success: boolean; processed: number; failed: number; message: string }> {
  await requireAdmin();

  if (!ids.length) return { success: false, processed: 0, failed: 0, message: "No IDs provided." };
  // Locked with no test accounts: nothing to try (with test accounts, each request is checked)
  if (action === "APPROVED" && payoutsLocked() && !payoutTestAccounts().length) {
    return { success: false, processed: 0, failed: ids.length, message: PAYOUTS_LOCKED_MESSAGE };
  }

  let processed = 0;
  let failed    = 0;
  let notificationFailures = 0;

  for (const id of ids) {
    try {
      const request = await applyWithdrawDecision(id, action, undefined, expected?.[id]);
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
      ? `${processed} ${verb}, ${failed} skipped (already processed, changed, or missing bank details).${notificationMessage}`
      : `${processed} request${processed !== 1 ? "s" : ""} ${verb} successfully.${notificationMessage}`,
  };
}
