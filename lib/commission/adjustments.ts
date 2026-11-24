import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { periodKeyOf, rebuildPayoutRequests, type PayoutRole } from "./lines";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * An adjustment on an order's commission (Commission Adjustment page): a
 * PENDING line, positive or negative, in the order's month, paid with that
 * month's payout. The order must be one the user earns commission on.
 */
export async function addCommissionAdjustment(opts: {
  userId: string; userRole: PayoutRole; orderId: string; amount: number; reason: string; by?: string | null;
}): Promise<{ id: string; periodKey: string }> {
  const amount = r2(opts.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter an amount other than zero.");
  const reason = opts.reason.trim();
  if (!reason) throw new Error("Enter the reason for the adjustment.");

  const order = await prisma.order.findUnique({
    where:  { id: opts.orderId },
    select: { id: true, orderNumber: true, createdAt: true, physicianId: true, salesRepId: true },
  });
  if (!order) throw new Error("Order not found.");
  const owner = opts.userRole === "PHYSICIAN" ? order.physicianId : order.salesRepId;
  if (owner !== opts.userId) throw new Error(`Order #${order.orderNumber} is not one of this ${opts.userRole === "PHYSICIAN" ? "doctor's" : "rep's"} orders.`);

  const periodKey = periodKeyOf(order.createdAt);
  const line = await prisma.commissionLine.create({
    data: {
      key: `adj:${randomUUID()}`, userId: opts.userId, userRole: opts.userRole,
      orderId: order.id, orderNumber: order.orderNumber, kind: "ADJUSTMENT", status: "PENDING",
      amount, periodKey, note: reason.slice(0, 500), by: opts.by ?? null,
    },
    select: { id: true },
  });
  await rebuildPayoutRequests(opts.userId, opts.userRole);
  return { id: line.id, periodKey };
}

/** Removes an adjustment that is not paid yet. */
export async function removeCommissionAdjustment(lineId: string): Promise<boolean> {
  const line = await prisma.commissionLine.findUnique({ where: { id: lineId }, select: { kind: true, status: true, userId: true, userRole: true } });
  if (!line || line.kind !== "ADJUSTMENT" || line.status !== "PENDING") return false;
  const gone = await prisma.commissionLine.deleteMany({ where: { id: lineId, status: "PENDING" } });
  await rebuildPayoutRequests(line.userId, line.userRole as PayoutRole);
  return gone.count === 1;
}

/**
 * Money owed back to a user outside an order's commission (a refund of an
 * order they paid with wallet credit, before the wallet was removed): paid
 * with their next payout, in the current month.
 */
export async function addOwedToUser(opts: { userId: string; userRole: PayoutRole; orderId: string | null; orderNumber: string | null; amount: number; note: string; key: string }): Promise<void> {
  if (await prisma.commissionLine.findUnique({ where: { key: opts.key }, select: { id: true } })) return;
  await prisma.commissionLine.create({
    data: {
      key: opts.key, userId: opts.userId, userRole: opts.userRole, orderId: opts.orderId, orderNumber: opts.orderNumber,
      kind: "ADJUSTMENT", status: "PENDING", amount: r2(opts.amount), periodKey: periodKeyOf(new Date()), note: opts.note.slice(0, 500),
    },
  });
  await rebuildPayoutRequests(opts.userId, opts.userRole);
}
