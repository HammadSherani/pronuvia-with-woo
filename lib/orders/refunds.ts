import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { orderRefundEmail } from "@/lib/email/templates";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";
import { syncPendingPayoutRequest } from "@/lib/withdrawals/sync";
import { moveWallet, moveWalletForOrder } from "@/lib/withdrawals/wallet-move";
import { upsertRunningPayoutRequest } from "@/lib/withdrawals/running-request";
import { getWooRefund, REFUND_ID_KEY, updateWooOrder, type WooOrderDetail } from "@/lib/woo/orders";
import { commissionNet, CUTS_META_KEY, reviewManaged } from "./commission-review";
import { recordCommissionEvent } from "./commission-history";
import { rejectAwaitingCommission } from "./commission-cancel";

// Refunds are made in WP admin only. Each Woo refund is picked up when the
// order is brought up to date (webhook, cron, opening it) and recorded here
// (OrderRefund, the order's returned total and clawbacks, its status). The
// money goes back the way it was paid: a wallet order to the wallet, a card
// order in Stripe (WooCommerce cannot reach the Stripe payment, which was
// taken here). A Stripe refund that fails is kept with its error and tried
// again by the cron; the team is alerted. Refunds tagged with our id
// (REFUND_ID_KEY) were made from the Pronuvia admin before and are skipped.
//
// Commission follows the order: a refund cuts each role's commission by the
// refunded share of the items (a full refund cuts all of it), at any stage.
// Commission already in the wallet comes off it (below zero if it was paid
// out already); a rejected one has nothing in the wallet, only its amount is
// cut for when it is approved. Each cut is in the Commission History, and the
// WP Commissions box shows it (CUTS_META_KEY).
//
// Commission: until the monthly sweep the clawback only lowers what the sweep
// credits (it credits commission − clawback); after it, the clawback is taken
// from the wallet in the current period.

export type RefundLine  = { index: number; returnedQty: number };
export type StoredRefundItem = { index: number; returnedQty: number; lineTotal: number };
type RefundMethod = "manual" | "stripe" | "wallet";

type OrderItem = { productId: string; variationId?: number | null; title: string; variantSize: string; unitPrice: number; quantity: number; lineTotal: number };

const ALERT_TO = "sales1.pronuvia@gmail.com";
const round2 = (n: number) => parseFloat(n.toFixed(2));

const ORDER_SELECT = {
  id: true, orderNumber: true, status: true, total: true, subtotal: true, items: true,
  salesRepId: true, physicianId: true,
  salesRepCommissionAmount: true, physicianCommissionAmount: true,
  commissionPaid: true, wooOrderId: true,
  salesRepCommissionReview: true, physicianCommissionReview: true,
  returnedAt: true, returnedTotal: true, returnReason: true,
  salesRepClawback: true, physicianClawback: true,
  stripePaymentIntentId: true,
  customerEmail: true, customerPhone: true, shippingRate: true, paymentMethod: true, createdAt: true,
  billingAddress: true, shippingAddress: true, notes: true,
  couponCode: true, discountAmount: true,
  salesRep:  { select: { email: true } },
  physician: { select: { email: true, firstName: true } },
} satisfies Prisma.OrderSelect;

type RefundOrder = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

type Plan = { lines: RefundLine[]; isFull: boolean; stored: StoredRefundItem[]; eventTotal: number };

/** Quantities still refundable per item, after earlier refunds. */
async function remainingQuantities(order: RefundOrder): Promise<{ items: OrderItem[]; remaining: Map<number, number>; count: number }> {
  const items = order.items as unknown as OrderItem[];
  const refunds = await prisma.orderRefund.findMany({ where: { orderId: order.id } });
  const refunded = new Map<number, number>();
  for (const r of refunds) {
    if (!r.items) items.forEach((it, i) => refunded.set(i, it.quantity));   // legacy full refund
    else for (const ri of r.items as StoredRefundItem[]) refunded.set(ri.index, (refunded.get(ri.index) ?? 0) + ri.returnedQty);
  }
  const remaining = new Map(items.map((it, i) => [i, Math.max(0, it.quantity - (refunded.get(i) ?? 0))]));
  return { items, remaining, count: refunds.length };
}

function plan(items: OrderItem[], remaining: Map<number, number>, lines: RefundLine[] | null): Plan | string {
  const total = [...remaining.values()].reduce((s, v) => s + v, 0);
  if (total === 0) return "All items on this order have already been refunded.";

  let chosen: RefundLine[];
  let isFull: boolean;
  if (lines === null) {
    chosen = items.map((_, i) => ({ index: i, returnedQty: remaining.get(i) ?? 0 })).filter((l) => l.returnedQty > 0);
    isFull = true;
  } else {
    chosen = lines.filter((l) => l.returnedQty > 0);
    if (!chosen.length) return "No items selected for refund.";
    for (const l of chosen) {
      const left = remaining.get(l.index) ?? 0;
      if (l.returnedQty > left) return `Item #${l.index + 1} exceeds remaining refundable quantity (${left}).`;
    }
    isFull = items.every((_, i) => {
      const left = remaining.get(i) ?? 0;
      return left === 0 || (chosen.find((l) => l.index === i)?.returnedQty ?? 0) >= left;
    });
  }

  const stored = chosen.map((l) => {
    const item = items[l.index];
    return { index: l.index, returnedQty: l.returnedQty, lineTotal: round2((item?.lineTotal ?? 0) * (item ? l.returnedQty / item.quantity : 0)) };
  });
  const eventTotal = round2(stored.reduce((s, x) => s + x.lineTotal, 0));
  if (eventTotal <= 0) return "Refund amount is zero.";
  return { lines: chosen, isFull, stored, eventTotal };
}

/**
 * Records one refund here: the OrderRefund, a wallet credit for wallet
 * refunds, the commission clawback, the order's totals and status, and the
 * refund email. Returns null when this Woo refund was already recorded.
 */
async function record(order: RefundOrder, p: Plan, opts: {
  refundNumber: number;
  amount:       number;               // money back to the customer
  method:       RefundMethod | null;
  reason:       string;
  wooRefundId?:    number | null;
  source:       "pronuvia" | "woocommerce";
}): Promise<{ id: string; salesRepClawback: number; physicianClawback: number } | null> {
  const repLeft = Math.max(0, order.salesRepCommissionAmount  - (order.salesRepClawback  ?? 0));
  const drLeft  = Math.max(0, order.physicianCommissionAmount - (order.physicianClawback ?? 0));
  const share   = Math.min(1, p.eventTotal / (order.subtotal > 0 ? order.subtotal : order.total));
  // The refunded share of each commission (all that is left on a full refund)
  const managed = reviewManaged(order);
  const salesRepClawback  = p.isFull ? repLeft : round2(Math.min(repLeft, order.salesRepCommissionAmount  * share));
  const physicianClawback = p.isFull ? drLeft  : round2(Math.min(drLeft,  order.physicianCommissionAmount * share));

  let refund;
  try {
    refund = await prisma.orderRefund.create({
      data: {
        orderId:              order.id,
        refundNumber:         opts.refundNumber,
        items:                p.stored as object[],
        total:                opts.amount,
        salesRepClawback,
        physicianClawback,
        reason:               opts.reason.trim() || null,
        customerRefundMethod: opts.amount > 0 ? opts.method : null,
        customerRefundAmount: opts.amount > 0 ? opts.amount : null,
        wooRefundId:          opts.wooRefundId ?? null,
        source:               opts.source,
      },
    });
  } catch (e) {
    // The unique index on wooRefundId: another update imported it already
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }

  const period = getCurrentPeriod(new Date(), process.env.PAYOUT_TIMEZONE ?? "UTC");

  // Wallet orders get the money back on the wallet that paid
  if (opts.method === "wallet" && opts.amount > 0) {
    const payer = order.physicianId
      ? { role: "PHYSICIAN" as const, id: order.physicianId }
      : order.salesRepId ? { role: "SALES_REP" as const, id: order.salesRepId } : null;
    if (payer) {
      const balance = await moveWallet(payer.role, payer.id, opts.amount);
      await prisma.walletTransaction.create({
        data: {
          userId: payer.id, userRole: payer.role, amount: opts.amount, type: "CREDIT",
          description: `Refund #${opts.refundNumber} on order #${order.orderNumber}`,
          orderId: order.id, periodKey: period.key, balance,
        },
      });
      await syncPendingPayoutRequest(payer.id, payer.role, balance);
    }
  }

  // Commission in the wallet (in payout or paid out): the approved part of
  // the cut comes off it now (negative balance allowed)
  for (const [role, id, cut, amount, claw, review] of [
    ["SALES_REP", order.salesRepId, salesRepClawback, order.salesRepCommissionAmount, order.salesRepClawback, order.salesRepCommissionReview],
    ["PHYSICIAN", order.physicianId, physicianClawback, order.physicianCommissionAmount, order.physicianClawback, order.physicianCommissionReview],
  ] as const) {
    if (!id || cut <= 0) continue;
    const debit = order.commissionPaid ? round2(commissionNet(review, amount, claw) - commissionNet(review, amount, (claw ?? 0) + cut)) : 0;
    if (debit > 0) {
      await moveWalletForOrder({
        role, userId: id, orderId: order.id, delta: -debit,
        description: `Commission cut — refund #${opts.refundNumber} on order #${order.orderNumber}`,
      });
      await upsertRunningPayoutRequest(id, role);
    }
    const before = round2(Math.max(0, amount - (claw ?? 0)));
    await recordCommissionEvent({
      key: `order-refund:${refund.id}:${role}`, orderId: order.id, userRole: role, action: "ORDER_REFUND",
      amount: round2(before - cut), previousAmount: before, walletChange: debit ? -debit : null,
      note: `Refund #${opts.refundNumber}: ${p.isFull ? "order fully refunded" : `$${p.eventTotal.toFixed(2)} of $${order.subtotal.toFixed(2)} refunded`}${opts.reason.trim() ? ` (${opts.reason.trim()})` : ""}`,
    });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ...(p.isFull && { status: OrderStatus.REFUNDED, ...(!managed && { commissionPaid: false }) }),
      returnedAt:        order.returnedAt ?? new Date(),
      returnReason:      opts.reason.trim() || order.returnReason || null,
      returnedTotal:     round2((order.returnedTotal ?? 0) + opts.amount),
      salesRepClawback:  round2((order.salesRepClawback  ?? 0) + salesRepClawback),
      physicianClawback: round2((order.physicianClawback ?? 0) + physicianClawback),
    },
  });

  // The WP Commissions box shows what order refunds cut
  if (order.wooOrderId && (salesRepClawback > 0 || physicianClawback > 0)) {
    const all = await prisma.orderRefund.findMany({ where: { orderId: order.id }, select: { salesRepClawback: true, physicianClawback: true } });
    const cuts = {
      physician: round2(all.reduce((t, r) => t + r.physicianClawback, 0)),
      sales_rep: round2(all.reduce((t, r) => t + r.salesRepClawback, 0)),
    };
    await updateWooOrder(order.wooOrderId, { meta_data: [{ key: CUTS_META_KEY, value: JSON.stringify(cuts) }] })
      .catch((e) => console.error(`[refunds] order ${order.orderNumber}: commission cut not sent to WooCommerce:`, e));
  }

  // Fully refunded: commission still awaiting review is rejected too
  if (p.isFull) await rejectAwaitingCommission(order.id, "refunded");

  await refundEmail(order, p, opts.amount, opts.reason);
  return { id: refund.id, salesRepClawback, physicianClawback };
}

async function refundEmail(order: RefundOrder, p: Plan, amount: number, reason: string) {
  const items = order.items as unknown as OrderItem[];
  const to = order.customerEmail ?? order.physician?.email ?? "";
  if (!to) return;
  try {
    const { subject, html } = orderRefundEmail({
      orderNumber:     order.orderNumber,
      orderDate:       order.createdAt,
      refundAmount:    amount || p.eventTotal,
      reason:          reason.trim() || null,
      note:            reason.trim() || null,
      items: p.lines.map((l) => ({
        title: items[l.index].title, variantSize: items[l.index].variantSize, quantity: l.returnedQty,
        unitPrice: items[l.index].unitPrice, lineTotal: round2(items[l.index].unitPrice * l.returnedQty),
      })),
      subtotal:        order.subtotal,
      shippingCost:    order.shippingRate ?? 0,
      couponCode:      order.couponCode ?? null,
      discountAmount:  order.discountAmount ?? 0,
      paymentMethod:   order.paymentMethod ?? null,
      billingAddress:  order.billingAddress ?? null,
      shippingAddress: order.shippingAddress ?? null,
      contactEmail:    order.customerEmail ?? null,
      contactPhone:    order.customerPhone ?? null,
    });
    const toPatient = !!order.customerEmail;
    const cc  = [...new Set([toPatient ? null : order.physician?.email, toPatient ? null : order.salesRep?.email].filter((e): e is string => !!e && e !== to))];
    const bcc = toPatient && order.physician?.email ? [order.physician.email] : [];
    await sendMail({ to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Refund", relatedId: order.orderNumber });
  } catch (e) {
    console.error("[refunds] refund email failed:", e);
  }
}

// ── refunds made in WP admin ──

/**
 * Records refunds found on the Woo order that we did not make (WP admin, or
 * Woo's own refund when its status was set to Refunded there).
 */
export async function importWooRefunds(orderId: string, w: WooOrderDetail): Promise<void> {
  if (!w.refunds?.length) return;
  const known = new Set((await prisma.orderRefund.findMany({
    where: { orderId, wooRefundId: { in: w.refunds.map((r) => r.id) } }, select: { wooRefundId: true },
  })).map((r) => r.wooRefundId));

  // Oldest first, so refund numbers follow the order they were made in
  for (const summary of [...w.refunds].reverse()) {
    if (known.has(summary.id)) continue;
    const refund = await getWooRefund(w.id, summary.id);
    if (refund.meta_data.some((m) => m.key === REFUND_ID_KEY)) continue;   // one of ours, being saved

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: ORDER_SELECT });
    const { items, remaining, count } = await remainingQuantities(order);
    const amount = round2(Math.abs(Number(refund.amount)));

    // Items refunded in Woo → ours by product / variation
    const lines: RefundLine[] = [];
    for (const rl of refund.line_items) {
      let qty = Math.abs(rl.quantity);
      for (let i = 0; i < items.length && qty > 0; i++) {
        const it = items[i];
        const same = it.variationId ? it.variationId === rl.variation_id : Number(it.productId) === rl.product_id;
        const already = lines.find((l) => l.index === i)?.returnedQty ?? 0;
        const left = (remaining.get(i) ?? 0) - already;
        if (!same || left <= 0) continue;
        const take = Math.min(qty, left);
        const existing = lines.find((l) => l.index === i);
        if (existing) existing.returnedQty += take; else lines.push({ index: i, returnedQty: take });
        qty -= take;
      }
    }

    let p: Plan | string;
    if (lines.length) p = plan(items, remaining, lines);
    else if (w.status === "refunded") p = plan(items, remaining, null);          // whole order refunded
    else {
      // Money only, no items: the commission share follows the amount
      const left = [...remaining.values()].reduce((s, v) => s + v, 0);
      p = left === 0 ? "nothing left" : { lines: [], isFull: false, stored: [], eventTotal: Math.min(amount, order.subtotal) };
    }
    if (typeof p === "string") continue;

    const wallet = order.paymentMethod === "WALLET";
    const card   = !wallet && !!order.stripePaymentIntentId;
    const done = await record(order, p, {
      refundNumber: count + 1, amount, method: wallet ? "wallet" : card ? "stripe" : "manual",
      reason: refund.reason || "Refunded in WooCommerce", wooRefundId: refund.id, source: "woocommerce",
    });
    if (!done || amount <= 0 || wallet) continue;
    if (card) await refundCard(done.id, { first: true });
    else await alert(order.orderNumber, `Order ${order.orderNumber} refunded in WP admin: no card payment to refund`,
      `A $${amount.toFixed(2)} refund was made on order ${order.orderNumber} in WP admin. The order has no Stripe payment, so no money was sent back automatically: return it to the customer by hand.`);
  }
}

function alert(orderNumber: string, subject: string, text: string) {
  return sendMail({ to: ALERT_TO, type: "WooCommerce Refund Alert", relatedId: orderNumber, subject, html: `<p>${text}</p>` })
    .catch((e) => console.error("[refunds] alert email failed:", e));
}

/**
 * Sends a WP admin refund back to the card in Stripe, once: a Stripe refund
 * already made for this record (found by its metadata) is taken instead of a
 * new one, and the idempotency key covers repeats in a row. On failure the
 * error is kept for the cron; the team is told the first time.
 */
async function refundCard(refundId: string, opts: { first: boolean }): Promise<boolean> {
  const r = await prisma.orderRefund.findUniqueOrThrow({ where: { id: refundId } });
  if (r.stripeRefundId) return true;
  const order = await prisma.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { orderNumber: true, stripePaymentIntentId: true } });
  const amount = r.customerRefundAmount ?? 0;
  if (!order.stripePaymentIntentId || amount <= 0) return false;

  let error: string;
  try {
    const { stripe } = await import("@/lib/stripe/server");
    if (!stripe) throw new Error("Stripe is not configured on this server.");
    const made = (await stripe.refunds.list({ payment_intent: order.stripePaymentIntentId, limit: 100 })).data
      .find((x) => x.metadata?.pronuvia_refund_id === r.id && x.status !== "failed" && x.status !== "canceled");
    const stripeRefund = made ?? await stripe.refunds.create(
      { payment_intent: order.stripePaymentIntentId, amount: Math.round(amount * 100),
        metadata: { pronuvia_refund_id: r.id, order_number: order.orderNumber, woo_refund_id: String(r.wooRefundId ?? "") } },
      { idempotencyKey: `woo-refund-${r.orderId}-${r.wooRefundId ?? r.id}` },
    );
    await prisma.orderRefund.update({ where: { id: r.id }, data: { stripeRefundId: stripeRefund.id, stripeRefundError: null } });
    return true;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  console.error(`[refunds] order ${order.orderNumber}: Stripe refund failed:`, error);
  await prisma.orderRefund.update({ where: { id: r.id }, data: { stripeRefundError: error } });
  if (opts.first) {
    await alert(order.orderNumber, `Order ${order.orderNumber}: Stripe refund failed, will retry`,
      `A $${amount.toFixed(2)} refund was made on order ${order.orderNumber} in WP admin, but Stripe did not take the card refund: ${error}. It is tried again once a day; if it keeps failing, refund the card in the Stripe dashboard.`);
  }
  return false;
}

/** Cron: card refunds from WP admin that Stripe did not take yet (last 30 days). */
export async function retryStripeRefunds(): Promise<{ retried: number; refunded: number }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.orderRefund.findMany({
    where:  { stripeRefundError: { not: null }, processedAt: { gte: since }, OR: [{ stripeRefundId: null }, { stripeRefundId: { isSet: false } }] },
    select: { id: true },
  });
  let refunded = 0;
  for (const r of rows) if (await refundCard(r.id, { first: false })) refunded++;
  return { retried: rows.length, refunded };
}
