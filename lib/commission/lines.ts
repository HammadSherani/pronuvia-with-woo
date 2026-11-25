import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { commissionNet } from "@/lib/orders/commission-review";
import { APP_TIMEZONE, getLocalDateParts } from "@/lib/utils/timezone";

// Commission without a wallet: every commission is a CommissionLine on its
// order, in the order's month. This file keeps the lines in step with the
// order (reconcileOrderCommission) and groups a user's PENDING lines into
// one payout request per month (rebuildPayoutRequests). See the model in
// prisma/schema.prisma.
//
// One rule decides what an order's commission line should be, so approve,
// modify, reject, partial refund, cancellation and payout all end up right
// however often and in whatever order they happen:
//   target  = what the order's commission is worth now (approved, less what
//             refunds cut; 0 if cancelled / refunded / not approved)
//   paid    = what was already paid for it (PAID lines, deductions included)
//   open    = target − paid (less what the admin cancelled): one PENDING line
//             ("open:<orderId>:<role>"); positive → paid in the order's month,
//             negative → a DEDUCTION taken off the user's next payout.

export type PayoutRole = "PHYSICIAN" | "SALES_REP";
const r2 = (n: number) => Math.round(n * 100) / 100;

/** "YYYY-MM" of a date in the app's time zone (New York). */
export function periodKeyOf(date: Date): string {
  const p = getLocalDateParts(date, APP_TIMEZONE);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** "October 2026" for "2026-10". */
export function periodLabel(key: string | null | undefined): string {
  const m = key?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return "—";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

const openKey = (orderId: string, role: PayoutRole) => `open:${orderId}:${role}`;

const ROLE_FIELDS = {
  PHYSICIAN: { user: "physicianId", amount: "physicianCommissionAmount", clawback: "physicianClawback", review: "physicianCommissionReview" },
  SALES_REP: { user: "salesRepId",  amount: "salesRepCommissionAmount",  clawback: "salesRepClawback",  review: "salesRepCommissionReview" },
} as const;

/**
 * Brings an order's commission lines in step with the order, for both roles,
 * then rebuilds the payout requests of everyone affected. Safe to call any
 * number of times. Commission that came from the old site (OLD_SITE lines on
 * the order) is left as it was: the admin pays or cancels it on Commission
 * Payout.
 */
export async function reconcileOrderCommission(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true, orderNumber: true, status: true, commissionPaid: true, createdAt: true,
      physicianId: true, physicianCommissionAmount: true, physicianClawback: true, physicianCommissionReview: true,
      salesRepId: true, salesRepCommissionAmount: true, salesRepClawback: true, salesRepCommissionReview: true,
    },
  });
  if (!order) return;
  const touched = new Map<string, PayoutRole>();

  for (const role of ["PHYSICIAN", "SALES_REP"] as const) {
    const f = ROLE_FIELDS[role];
    const userId = order[f.user] as string | null;
    const lines = await prisma.commissionLine.findMany({
      where:  { orderId, userRole: role },
      select: { id: true, key: true, kind: true, status: true, amount: true, userId: true, periodKey: true },
    });
    // Settled on the old site for this person: not ours to recompute (an old
    // row of someone else, e.g. the upline's upline, doesn't count)
    if (lines.some((l) => l.kind === "OLD_SITE" && l.userId === userId)) continue;
    const open = lines.find((l) => l.key === openKey(orderId, role));
    if (open?.userId && open.userId !== userId) touched.set(open.userId, role);

    // A commission still awaiting review: nothing to pay yet, nothing to take back
    const review = order[f.review];
    if (review === "AWAITING" && !lines.some((l) => l.status === "PAID")) {
      if (open?.status === "PENDING") await prisma.commissionLine.delete({ where: { id: open.id } }).catch(() => {});
      continue;
    }

    const live   = order.status !== "CANCELLED" && order.status !== "REFUNDED" && order.commissionPaid;
    const target = live ? commissionNet(review, order[f.amount] as number, order[f.clawback] as number | null) : 0;
    const orderLines = lines.filter((l) => l.kind === "ORDER" || l.kind === "DEDUCTION");
    const paid      = r2(orderLines.filter((l) => l.status === "PAID").reduce((s, l) => s + l.amount, 0));
    const cancelled = r2(orderLines.filter((l) => l.status === "CANCELLED" && l.amount > 0).reduce((s, l) => s + l.amount, 0));
    const want = target >= paid ? r2(Math.max(0, target - paid - cancelled)) : r2(target - paid);

    if (!userId || want === 0) {
      if (open?.status === "PENDING") await prisma.commissionLine.delete({ where: { id: open.id } }).catch(() => {});
      if (open?.userId) touched.set(open.userId, role);
      continue;
    }
    if (open && open.status === "PENDING" && open.amount === want && open.userId === userId) { touched.set(userId, role); continue; }

    const data = {
      userId, userRole: role as Role, orderId, orderNumber: order.orderNumber,
      kind: want > 0 ? "ORDER" as const : "DEDUCTION" as const,
      status: "PENDING" as const, amount: want,
      // A deduction belongs to the month it happened; commission to the order's month
      periodKey: want > 0 ? periodKeyOf(order.createdAt) : (open?.amount !== undefined && open.amount < 0 ? open.periodKey : periodKeyOf(new Date())),
      note: want > 0 ? null : `Taken back from order #${order.orderNumber} (refund / cancellation after payout)`,
    };
    await upsertByKey(openKey(orderId, role), data);
    touched.set(userId, role);
  }

  for (const [userId, role] of touched) await rebuildPayoutRequests(userId, role);
}

// Two refreshes at once (webhook + page view) may both create: the unique key decides
async function upsertByKey(key: string, data: Omit<Prisma.CommissionLineUncheckedCreateInput, "key">): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try {
      await prisma.commissionLine.upsert({ where: { key }, create: { key, ...data }, update: { ...data, payoutId: null } });
      return;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) continue;
      throw e;
    }
  }
}

/**
 * Groups the user's PENDING lines into one payout request per month (the
 * commission month). A deduction is taken off the user's oldest month that
 * has something to pay (their next payout); with nothing to pay it waits as
 * its own (negative) request. Requests left without lines are removed. The
 * admin's approval pays exactly the lines of a request (and checks the amount
 * it showed).
 */
export async function rebuildPayoutRequests(userId: string, userRole: PayoutRole): Promise<void> {
  const lines = await prisma.commissionLine.findMany({
    where:  { userId, userRole, status: "PENDING" },
    select: { id: true, kind: true, amount: true, periodKey: true, payoutId: true },
  });
  const sums = new Map<string, number>();
  for (const l of lines) if (l.kind !== "DEDUCTION") sums.set(l.periodKey, r2((sums.get(l.periodKey) ?? 0) + l.amount));
  const payable = [...sums].filter(([, s]) => s > 0).map(([k]) => k).sort();
  const groupOf = (l: (typeof lines)[number]) => (l.kind === "DEDUCTION" && payable.length ? payable[0] : l.periodKey);

  const groups = new Map<string, typeof lines>();
  for (const l of lines) { const k = groupOf(l); groups.set(k, [...(groups.get(k) ?? []), l]); }

  const pending = await prisma.withdrawRequest.findMany({
    where:  { userId, userRole, status: "PENDING" },
    select: { id: true, periodKey: true, amount: true },
    orderBy: { createdAt: "asc" },
  });
  const byPeriod = new Map<string, string>();
  const extra: string[] = [];
  for (const p of pending) {
    if (p.periodKey && !byPeriod.has(p.periodKey) && groups.has(p.periodKey)) byPeriod.set(p.periodKey, p.id);
    else extra.push(p.id);
  }

  const now = new Date();
  for (const [period, ls] of groups) {
    const amount = r2(ls.reduce((s, l) => s + l.amount, 0));
    let id = byPeriod.get(period);
    if (id) {
      await prisma.withdrawRequest.update({ where: { id }, data: { amount, snapshotAt: now } });
    } else {
      id = (await prisma.withdrawRequest.create({
        data: { userId, userRole, amount, status: "PENDING", note: "Commission payout", periodKey: period, snapshotAt: now },
        select: { id: true },
      })).id;
    }
    const move = ls.filter((l) => l.payoutId !== id).map((l) => l.id);
    if (move.length) await prisma.commissionLine.updateMany({ where: { id: { in: move }, status: "PENDING" }, data: { payoutId: id } });
  }
  // Only requests still pending and empty (an approval running now keeps its own)
  if (extra.length) {
    const stillUsed = new Set((await prisma.commissionLine.findMany({ where: { payoutId: { in: extra } }, select: { payoutId: true } })).map((l) => l.payoutId));
    const drop = extra.filter((id) => !stillUsed.has(id));
    if (drop.length) await prisma.withdrawRequest.deleteMany({ where: { id: { in: drop }, status: "PENDING" } });
  }
}

/**
 * Daily safety pass (cron): every user with commission waiting gets their
 * payout requests rebuilt, so a request a failed refresh left behind is put
 * right. Changes nothing when everything is in step.
 */
export async function refreshAllPayoutRequests(): Promise<{ users: number }> {
  const users = await prisma.commissionLine.groupBy({ by: ["userId", "userRole"], where: { status: "PENDING" } });
  // Also users whose last pending line went away but whose request stayed
  const orphans = await prisma.withdrawRequest.findMany({ where: { status: "PENDING" }, select: { userId: true, userRole: true }, distinct: ["userId", "userRole"] });
  const all = new Map<string, PayoutRole>();
  for (const u of [...users, ...orphans]) all.set(`${u.userId}:${u.userRole}`, u.userRole as PayoutRole);
  for (const [k, role] of all) await rebuildPayoutRequests(k.split(":")[0], role);
  return { users: all.size };
}

/** Gives a line that leaves PENDING a key of its own, so the order can get a new open line. */
export const settledKey = (status: "paid" | "cancelled", lineId: string) => `${status}:${lineId}:${randomUUID().slice(0, 8)}`;

/** Approved commission waiting to be paid, per user (for lists and exports). */
export async function pendingCommissionByUser(userRole: PayoutRole, userIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.commissionLine.groupBy({
    by: ["userId"], where: { userRole, status: "PENDING", ...(userIds && { userId: { in: userIds } }) }, _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.userId, r2(r._sum.amount ?? 0)]));
}

/** The user's commission at a glance: pending (by month), needs review, paid. */
export async function commissionSummary(userId: string, userRole: PayoutRole) {
  const rows = await prisma.commissionLine.groupBy({
    by: ["status"], where: { userId, userRole }, _sum: { amount: true },
  });
  const sum = (s: string) => r2(rows.find((r) => r.status === s)?._sum.amount ?? 0);
  return { pending: sum("PENDING"), needsReview: sum("NEEDS_REVIEW"), paid: sum("PAID") };
}
