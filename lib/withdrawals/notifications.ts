import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { commissionPayoutEmail } from "@/lib/email/templates";
import { generateCommissionStatementPdf } from "@/lib/pdf/commission-statement";
import { getPayoutStatementOrders } from "@/lib/withdrawals/statement";
import { parsePayoutPeriod } from "@/lib/withdrawals/monthly";
import type { Role } from "@/generated/prisma/enums";

export type ApprovedPayoutRequest = {
  id: string;
  amount: number;
  userId: string;
  userRole: Role;
  note: string | null;
  createdAt: Date;
  snapshotAt?: Date | null;
};

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

/**
 * Delivers one payout statement at-least-once, with a database claim to stop
 * concurrent admin clicks and cron retries from sending duplicate messages.
 */
export async function sendPayoutApprovalEmail(
  request: ApprovedPayoutRequest,
  options?: { recoverStaleProcessing?: boolean },
): Promise<boolean> {
  const staleProcessingBefore = new Date(Date.now() - 15 * 60 * 1000);
  const claimed = await prisma.withdrawRequest.updateMany({
    where: {
      id: request.id,
      status: "APPROVED",
      OR: [
        { notificationStatus: { in: ["PENDING", "FAILED"] } },
        ...(options?.recoverStaleProcessing
          ? [{ notificationStatus: "PROCESSING" as const, notificationLastAttemptAt: { lt: staleProcessingBefore } }]
          : []),
      ],
    },
    data: {
      notificationStatus: "PROCESSING",
      notificationAttempts: { increment: 1 },
      notificationLastAttemptAt: new Date(),
      notificationLastError: null,
    },
  });

  if (claimed.count !== 1) return false;

  try {
    const isPhysician = request.userRole === "PHYSICIAN";
    const user = isPhysician
      ? await prisma.partneringPhysician.findUnique({
          where: { id: request.userId },
          select: { firstName: true, lastName: true, email: true, bankName: true, bankAccountName: true },
        })
      : await prisma.salesRepresentative.findUnique({
          where: { id: request.userId },
          select: { firstName: true, lastName: true, email: true, bankName: true, bankAccountName: true },
        });

    if (!user) throw new Error("Payout recipient was not found.");

    const snapshotAt = request.snapshotAt ?? request.createdAt;
    const orders = await getPayoutStatementOrders({
      userId: request.userId,
      userRole: request.userRole,
      requestCreatedAt: snapshotAt,
    });
    const period = parsePayoutPeriod(request.note, snapshotAt);
    const pdfOrders = orders.map((order) => ({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      amount: order.amount,
      rate: order.rate,
      description: order.description,
    }));

    const [pdfBuffer, { subject, html }] = await Promise.all([
      generateCommissionStatementPdf({
        recipientName: `${user.firstName} ${user.lastName}`,
        role: isPhysician ? "Partnering Physician" : "Medical Representative",
        period,
        orders: pdfOrders,
        totalAmount: request.amount,
        bankName: user.bankName,
        bankAccountName: user.bankAccountName ?? null,
      }),
      Promise.resolve(commissionPayoutEmail({
        firstName: user.firstName,
        amount: request.amount,
        period,
        orderCount: orders.length,
      })),
    ]);

    const safePeriod = period.replace(/[^a-zA-Z0-9]+/g, "-");
    await sendMail({
      to: user.email,
      subject,
      html,
      attachments: [{
        filename: `commission-statement-${safePeriod}.pdf`,
        content: pdfBuffer,
        type: "application/pdf",
      }],
    });

    await prisma.withdrawRequest.update({
      where: { id: request.id },
      data: { notificationStatus: "SENT", notificationLastError: null },
    });
    return true;
  } catch (error) {
    await prisma.withdrawRequest.update({
      where: { id: request.id },
      data: {
        notificationStatus: "FAILED",
        notificationLastError: errorMessage(error),
      },
    }).catch((updateError) => {
      console.error("[payout-email] could not persist failed status:", updateError);
    });
    throw error;
  }
}

export async function processPendingPayoutNotifications(limit = 25) {
  const requests = await prisma.withdrawRequest.findMany({
    where: {
      status: "APPROVED",
      notificationStatus: { in: ["PENDING", "FAILED", "PROCESSING"] },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      userId: true,
      userRole: true,
      note: true,
      createdAt: true,
      snapshotAt: true,
      notificationAttempts: true,
      notificationLastAttemptAt: true,
    },
  });

  let sent = 0;
  let failed = 0;
  const retryAfterMs = 5 * 60 * 1000;

  for (const request of requests) {
    if (request.notificationAttempts >= 10) continue;
    if (request.notificationLastAttemptAt
      && Date.now() - request.notificationLastAttemptAt.getTime() < retryAfterMs) continue;

    try {
      if (await sendPayoutApprovalEmail(request, { recoverStaleProcessing: true })) sent++;
    } catch (error) {
      failed++;
      console.error(`[payout-email] retry failed for ${request.id}:`, error);
    }
  }

  return { attempted: sent + failed, sent, failed };
}
