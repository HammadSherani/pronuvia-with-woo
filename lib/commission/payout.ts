import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/generated/prisma/enums";
import { bankDetailsComplete } from "@/lib/bank/labels";
import { rebuildPayoutRequests, settledKey, type PayoutRole } from "./lines";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type DecidedPayout = {
  id: string; amount: number; userId: string; userRole: Role;
  note: string | null; createdAt: Date; snapshotAt: Date | null; periodKey: string | null;
  /** Orders whose commission is now paid out (to tell WooCommerce) */
  paidOutOrderIds: string[];
};

/**
 * Pays a payout request: exactly its PENDING lines become PAID. When the
 * admin saw an amount (expectedAmount) and the lines no longer add up to it
 * (a refund or approval landed meanwhile), nothing is paid and the admin is
 * asked to reload. Needs complete bank details and something to pay.
 */
export async function approvePayout(requestId: string, opts: { adminNote?: string; expectedAmount?: number } = {}): Promise<DecidedPayout | null> {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.withdrawRequest.findUnique({
      where:  { id: requestId },
      select: { id: true, status: true, userId: true, userRole: true, note: true, createdAt: true, periodKey: true },
    });
    if (!request || request.status !== "PENDING") return null;

    const user = request.userRole === "PHYSICIAN"
      ? await tx.partneringPhysician.findUnique({ where: { id: request.userId }, select: { bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true } })
      : await tx.salesRepresentative.findUnique({ where: { id: request.userId }, select: { bankName: true, bankAccountNumber: true, bankAccountName: true, bankAccountType: true, bankOwnershipType: true } });
    if (!bankDetailsComplete(user)) throw new Error("User has incomplete bank account details.");

    const lines = await tx.commissionLine.findMany({
      where:  { payoutId: requestId, status: "PENDING" },
      select: { id: true, kind: true, amount: true, orderId: true },
    });
    const amount = r2(lines.reduce((s, l) => s + l.amount, 0));
    if (opts.expectedAmount !== undefined && Math.abs(amount - opts.expectedAmount) > 0.005) {
      throw new Error(`This payout changed to $${amount.toFixed(2)} (a refund or approval came in). Reload the page and check it again.`);
    }
    if (!lines.length || amount <= 0) throw new Error("Nothing to pay: the deductions in this payout are larger than the commission.");

    // Claim it: a second click pays nothing
    const claimed = await tx.withdrawRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "APPROVED", amount, snapshotAt: new Date(), adminNote: opts.adminNote?.trim() || null,
        notificationStatus: "PENDING", notificationAttempts: 0, notificationLastAttemptAt: null, notificationLastError: null,
      },
    });
    if (claimed.count !== 1) return null;

    const now = new Date();
    for (const l of lines) {
      await tx.commissionLine.update({ where: { id: l.id }, data: { status: "PAID", paidAt: now, key: settledKey("paid", l.id) } });
    }

    // The orders' commission is paid out: its WP review is fixed from now on
    const field = request.userRole === "PHYSICIAN" ? "physicianCommissionPaidOutAt" : "salesRepCommissionPaidOutAt";
    const amountField = request.userRole === "PHYSICIAN" ? "physicianCommissionAmount" : "salesRepCommissionAmount";
    const orderIds = [...new Set(lines.filter((l) => l.kind === "ORDER" && l.orderId).map((l) => l.orderId!))];
    const paidOut = orderIds.length
      ? await tx.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, [field]: true, [amountField]: true } })
      : [];
    const first = paidOut.filter((o) => !(o as Record<string, unknown>)[field]);
    if (first.length) await tx.order.updateMany({ where: { id: { in: first.map((o) => o.id) } }, data: { [field]: now } });
    if (orderIds.length) {
      await tx.commissionEvent.createMany({
        data: lines.filter((l) => l.orderId && (l.kind === "ORDER" || l.kind === "DEDUCTION")).map((l) => ({
          key: `paid-out:${l.orderId}:${request.userRole}:${randomUUID()}`, orderId: l.orderId!, userRole: request.userRole,
          action: l.kind === "DEDUCTION" ? "DEDUCTED" : "PAID_OUT", amount: l.amount,
        })),
      });
    }
    return { ...request, amount, snapshotAt: now, paidOutOrderIds: orderIds };
  });
  return result;
}

/**
 * Turns a payout request down: its commission will not be paid (the lines are
 * CANCELLED, so they don't come back). Deductions in it are not forgiven:
 * they move on to the user's next payout.
 */
export async function rejectPayout(requestId: string, opts: { adminNote?: string } = {}): Promise<DecidedPayout | null> {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.withdrawRequest.findUnique({
      where:  { id: requestId },
      select: { id: true, status: true, userId: true, userRole: true, note: true, createdAt: true, periodKey: true },
    });
    if (!request || request.status !== "PENDING") return null;
    const lines = await tx.commissionLine.findMany({ where: { payoutId: requestId, status: "PENDING" }, select: { id: true, kind: true, amount: true } });
    const cancel = lines.filter((l) => l.kind !== "DEDUCTION");
    const amount = r2(cancel.reduce((s, l) => s + l.amount, 0));
    const claimed = await tx.withdrawRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data:  { status: "REJECTED", amount, snapshotAt: new Date(), adminNote: opts.adminNote?.trim() || null },
    });
    if (claimed.count !== 1) return null;
    const now = new Date();
    for (const l of cancel) {
      await tx.commissionLine.update({
        where: { id: l.id },
        data:  { status: "CANCELLED", cancelledAt: now, key: settledKey("cancelled", l.id), ...(opts.adminNote?.trim() && { note: opts.adminNote.trim() }) },
      });
    }
    // Deductions wait for the next payout
    const carry = lines.filter((l) => l.kind === "DEDUCTION").map((l) => l.id);
    if (carry.length) await tx.commissionLine.updateMany({ where: { id: { in: carry } }, data: { payoutId: null } });
    return { ...request, amount, snapshotAt: now, paidOutOrderIds: [] };
  });
  if (result) await rebuildPayoutRequests(result.userId, result.userRole as PayoutRole);
  return result;
}
