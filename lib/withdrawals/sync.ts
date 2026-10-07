import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/generated/prisma/enums";
import { isMonthlyAutoPayoutNote } from "@/lib/withdrawals/monthly";

export type PendingWithdrawSnapshot = {
  id:        string;
  amount:    number;
  createdAt: Date | string | null;
  note?:     string | null;
};

export function reconcilePendingPayoutRequest({
  pending,
  availableBalance,
}: {
  pending: PendingWithdrawSnapshot[];
  availableBalance: number;
}) {
  const sorted = [...pending].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const keep = sorted[0] ?? null;
  const removedIds = sorted.slice(1).map((request) => request.id);

  if (!keep) {
    return { keepId: null, amount: 0, removedIds: [] };
  }

  if (availableBalance <= 0) {
    return { keepId: null, amount: 0, removedIds: sorted.map((request) => request.id) };
  }

  return {
    keepId: keep.id,
    amount: Number(Math.max(0, availableBalance).toFixed(2)),
    removedIds,
  };
}

export async function syncPendingPayoutRequest(
  userId:     string,
  userRole:   Role,
  newBalance: number,
  options?: {
    note?: string | null;
    createIfMissing?: boolean;
  },
) {
  const pending = await prisma.withdrawRequest.findMany({
    where:  { userId, userRole, status: "PENDING" },
    select: { id: true, amount: true, createdAt: true, note: true },
    orderBy: { createdAt: "desc" },
  });

  // Monthly requests are immutable snapshots. New commissions, purchases, or
  // clawbacks after the first-of-month snapshot must not change the amount an
  // administrator is reviewing for that month.
  if (pending.some((request) => isMonthlyAutoPayoutNote(request.note))) {
    return { updated: false, removed: 0, kept: pending[0]?.id ?? null, amount: pending[0]?.amount ?? 0 };
  }

  const normalizedBalance = Number(Math.max(0, newBalance).toFixed(2));

  if (normalizedBalance <= 0) {
    if (!pending.length) return { updated: false, removed: 0, kept: null, amount: 0 };
    const ids = pending.map((request) => request.id);
    await prisma.withdrawRequest.deleteMany({ where: { id: { in: ids } } });
    return { updated: false, removed: ids.length, kept: null, amount: 0 };
  }

  const { keepId, amount, removedIds } = reconcilePendingPayoutRequest({
    pending,
    availableBalance: normalizedBalance,
  });

  if (removedIds.length > 0) {
    await prisma.withdrawRequest.deleteMany({ where: { id: { in: removedIds } } });
  }

  if (keepId) {
    await prisma.withdrawRequest.update({
      where: { id: keepId },
      data: {
        amount: Number(amount.toFixed(2)),
        ...(options?.note ? { note: options.note } : {}),
      },
    });
    return {
      updated: true,
      removed: removedIds.length,
      kept: keepId,
      amount,
    };
  }

  if (options?.createIfMissing) {
    const created = await prisma.withdrawRequest.create({
      data: {
        userId,
        userRole,
        amount: Number(normalizedBalance.toFixed(2)),
        note: options.note ?? null,
      },
    });
    return {
      updated: true,
      removed: 0,
      kept: created.id,
      amount: Number(normalizedBalance.toFixed(2)),
    };
  }

  return { updated: false, removed: 0, kept: null, amount: normalizedBalance };
}

/**
 * Keeps the latest pending payout request aligned to the current wallet balance.
 * When stale duplicates exist, only the newest pending request is kept and the rest are removed.
 */
export async function syncPendingAutoWithdraw(
  userId:     string,
  userRole:   Role,
  newBalance: number,
) {
  return syncPendingPayoutRequest(userId, userRole, newBalance, {
    note: "Auto withdrawal",
  });
}
