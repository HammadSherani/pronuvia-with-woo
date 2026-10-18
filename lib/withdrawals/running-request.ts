import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/generated/prisma/enums";

/**
 * Keeps one pending payout request per user, for their whole wallet balance.
 * Approved commission lands in the wallet as soon as the admin approves it on
 * the WP order page, and this request is what the admin then pays out from
 * Commission Payout. Its snapshot moves to now, so the statement lists every
 * credit up to this moment. No balance left → no pending request.
 */
export async function upsertRunningPayoutRequest(userId: string, userRole: Role): Promise<void> {
  const user = userRole === "PHYSICIAN"
    ? await prisma.partneringPhysician.findUnique({ where: { id: userId }, select: { walletBalance: true } })
    : await prisma.salesRepresentative.findUnique({ where: { id: userId }, select: { walletBalance: true } });
  const balance = Number(Math.max(0, user?.walletBalance ?? 0).toFixed(2));

  const pending = await prisma.withdrawRequest.findMany({
    where:   { userId, userRole, status: "PENDING" },
    select:  { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (balance <= 0) {
    if (pending.length) await prisma.withdrawRequest.deleteMany({ where: { id: { in: pending.map((p) => p.id) } } });
    return;
  }

  const now = new Date();
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [keep, ...extra] = pending;
  if (extra.length) await prisma.withdrawRequest.deleteMany({ where: { id: { in: extra.map((p) => p.id) } } });
  if (keep) {
    await prisma.withdrawRequest.update({ where: { id: keep.id }, data: { amount: balance, snapshotAt: now } });
  } else {
    await prisma.withdrawRequest.create({
      data: { userId, userRole, amount: balance, note: "Commission payout", periodKey, snapshotAt: now },
    });
  }
}
