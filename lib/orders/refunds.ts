import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { orderRefundEmail } from "@/lib/email/templates";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";
import { syncPendingPayoutRequest } from "@/lib/withdrawals/sync";
import {
  createWooRefund, getWooOrder, getWooRefund, REFUND_ID_KEY, updateWooOrder, type WooOrderDetail,
} from "@/lib/woo/orders";
import { STATUS_META_KEY } from "./woo-status";

// Refunds and returns. A refund is recorded here (OrderRefund, the order's
// returned total and clawbacks, its status) and in WooCommerce (a refund on
// the Woo order, which puts the items back in stock).
//
// - Made in our admin: the money goes back first (Stripe, the payer's wallet,
//   or by hand), then the Woo refund is created and tagged with our id.
// - Made in WP admin: picked up when the order is brought up to date
//   (webhook, cron, opening it) and recorded the same way. A wallet order is
//   credited back to the wallet; a card order is not refunded in Stripe from
//   there, so the team is alerted.
//
// Commission: until the monthly sweep the clawback only lowers what the sweep
// credits (it credits commission − clawback); after it, the clawback is taken
// from the wallet in the current period.

export type RefundLine  = { index: number; returnedQty: number };
export type StoredRefundItem = { index: number; returnedQty: number; lineTotal: number };
export type RefundMoney = { method: "manual" | "stripe" | "wallet"; amount: number };

type OrderItem = { productId: string; variationId?: number | null; title: string; variantSize: string; unitPrice: number; quantity: number; lineTotal: number };

const ALERT_TO = "sales1.pronuvia@gmail.com";
const round2 = (n: number) => parseFloat(n.toFixed(2));

const ORDER_SELECT = {
  id: true, orderNumber: true, status: true, total: true, subtotal: true, items: true,
  salesRepId: true, physicianId: true,
  salesRepCommissionAmount: true, physicianCommissionAmount: true,
  commissionPaid: true, wooOrderId: true,
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

/** Changes a wallet by `delta` in one atomic step; returns the new balance. */
async function moveWallet(role: "SALES_REP" | "PHYSICIAN", id: string, delta: number): Promise<number> {
  const model = role === "SALES_REP" ? prisma.salesRepresentative : prisma.partneringPhysician;
  // Prisma delegates differ in type but share these calls
  const m = model as unknown as typeof prisma.salesRepresentative;
  const { walletBalance } = await m.update({ where: { id }, data: { walletBalance: { increment: delta } }, select: { walletBalance: true } });
  // Floating point leaves e.g. 5090.469999999999: store it rounded, unless
  // another change landed in between (then that one's value stands)
  const rounded = round2(walletBalance);
  if (rounded !== walletBalance) await m.updateMany({ where: { id, walletBalance }, data: { walletBalance: rounded } });
  return rounded;
}

/**
 * Records one refund here: the OrderRefund, a wallet credit for wallet
 * refunds, the commission clawback, the order's totals and status, and the
 * refund email. Returns null when this Woo refund was already recorded.
 */
async function record(order: RefundOrder, p: Plan, opts: {
  refundNumber: number;
  amount:       number;               // money back to the customer
  method:       RefundMoney["method"] | null;
  reason:       string;
  stripeRefundId?: string | null;
  wooRefundId?:    number | null;
  source:       "pronuvia" | "woocommerce";
}): Promise<{ id: string; salesRepClawback: number; physicianClawback: number } | null> {
  const repLeft = Math.max(0, order.salesRepCommissionAmount  - (order.salesRepClawback  ?? 0));
  const drLeft  = Math.max(0, order.physicianCommissionAmount - (order.physicianClawback ?? 0));
  const share   = Math.min(1, p.eventTotal / (order.subtotal > 0 ? order.subtotal : order.total));
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
        stripeRefundId:       opts.stripeRefundId ?? null,
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

  // Commission already paid out: take it back now (negative balance allowed)
  if (order.commissionPaid) {
    for (const [role, id, amount] of [
      ["SALES_REP", order.salesRepId, salesRepClawback],
      ["PHYSICIAN", order.physicianId, physicianClawback],
    ] as const) {
      if (!id || amount <= 0) continue;
      const balance = await moveWallet(role, id, -amount);
      await prisma.walletTransaction.create({
        data: {
          userId: id, userRole: role, amount, type: "DEBIT",
          description: `Commission clawback — refund #${opts.refundNumber} on order #${order.orderNumber}`,
          orderId: order.id, periodKey: period.key, balance,
        },
      });
      await syncPendingPayoutRequest(id, role, balance);
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ...(p.isFull && { status: OrderStatus.REFUNDED, commissionPaid: false }),
      returnedAt:        order.returnedAt ?? new Date(),
      returnReason:      opts.reason.trim() || order.returnReason || null,
      returnedTotal:     round2((order.returnedTotal ?? 0) + opts.amount),
      salesRepClawback:  round2((order.salesRepClawback  ?? 0) + salesRepClawback),
      physicianClawback: round2((order.physicianClawback ?? 0) + physicianClawback),
    },
  });

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

// ── refunds made in our admin ──

/** The Refund / Return action: money back, our record, then the Woo refund. */
export async function refundOrder(
  orderId: string,
  lines:   RefundLine[] | null,          // null = everything still refundable
  reason:  string,
  money?:  RefundMoney,
): Promise<{ success: boolean; message: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
  if (!order) return { success: false, message: "Order not found." };

  const { items, remaining, count } = await remainingQuantities(order);
  const p = plan(items, remaining, lines);
  if (typeof p === "string") return { success: false, message: p };

  const amount = money && money.amount > 0 ? round2(money.amount) : 0;
  if (amount > round2(order.total - (order.returnedTotal ?? 0)) + 0.005) {
    return { success: false, message: `The refund can't be more than what is left to refund ($${round2(order.total - (order.returnedTotal ?? 0)).toFixed(2)}).` };
  }

  // The money first; nothing is recorded if it fails
  let stripeRefundId: string | null = null;
  if (amount > 0 && money?.method === "stripe") {
    if (!order.stripePaymentIntentId) return { success: false, message: "No Stripe payment on this order — cannot process Stripe refund." };
    const { stripe } = await import("@/lib/stripe/server");
    if (!stripe) return { success: false, message: "Stripe is not configured on this server." };
    try {
      stripeRefundId = (await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId, amount: Math.round(amount * 100) })).id;
    } catch (e) {
      return { success: false, message: `Stripe error: ${e instanceof Error ? e.message : "Stripe refund failed."}` };
    }
  }
  if (amount > 0 && money?.method === "wallet" && order.paymentMethod !== "WALLET") {
    return { success: false, message: "Only wallet orders can be refunded to the wallet." };
  }

  const refundNumber = count + 1;
  const done = await record(order, p, {
    refundNumber, amount: amount || p.eventTotal, method: amount > 0 ? money!.method : null, reason, stripeRefundId, source: "pronuvia",
  });
  if (!done) return { success: false, message: "This refund was already recorded." };

  // WooCommerce: the refund record (restocks the items). The money has
  // moved, so a Woo failure is reported, not undone.
  let wooNote = "";
  if (order.wooOrderId) {
    try {
      const w = await getWooOrder(order.wooOrderId);
      const left = round2(Number(w.total) - w.refunds.reduce((s, r) => s + Math.abs(Number(r.total)), 0));
      const wooLines = p.lines.flatMap((l) => {
        const item = items[l.index];
        const wl = w.line_items[l.index]?.variation_id === (item.variationId ?? 0) || w.line_items[l.index]?.product_id === Number(item.productId)
          ? w.line_items[l.index]
          : w.line_items.find((x) => (item.variationId ? x.variation_id === item.variationId : x.product_id === Number(item.productId)));
        return wl ? [{ wooLineId: wl.id, quantity: l.returnedQty, total: round2(Number(wl.total) * l.returnedQty / wl.quantity) }] : [];
      });
      // The lines carry only the money actually returned: Woo adds a refund's
      // amount up from its lines when it is 0, so items coming back without
      // money must be $0 lines. Anything above the items is the shipping.
      const itemsValue = wooLines.reduce((s, l) => s + l.total, 0);
      const forItems   = Math.min(amount, itemsValue);
      let given = 0;
      wooLines.forEach((l, i) => {
        l.total = i === wooLines.length - 1 ? round2(forItems - given) : round2(itemsValue ? l.total * forItems / itemsValue : 0);
        given = round2(given + l.total);
      });
      // Only the money actually returned (0 when items come back without it)
      const wooRefund = await createWooRefund(order.wooOrderId, {
        amount: Math.min(amount, left), reason: reason.trim() || `Refund #${refundNumber}`, lines: wooLines, ourId: done.id,
      });
      await prisma.orderRefund.update({ where: { id: done.id }, data: { wooRefundId: wooRefund.id } });
      // Woo marks the order Refunded itself once all its money is refunded.
      // Short of that (e.g. shipping kept), setting the status would make Woo
      // refund the rest on its own, so only our status goes along.
      if (p.isFull) await updateWooOrder(order.wooOrderId, { meta_data: [{ key: STATUS_META_KEY, value: OrderStatus.REFUNDED }] });
    } catch (e) {
      console.error(`[refunds] order ${order.orderNumber}: Woo refund not created:`, e);
      wooNote = ` WooCommerce refund was not recorded (${e instanceof Error ? e.message : String(e)}); add it in WP admin so stock is correct.`;
    }
  }

  const how = stripeRefundId ? ` Stripe refund $${amount.toFixed(2)} sent.`
    : money?.method === "wallet" && amount > 0 ? ` $${amount.toFixed(2)} credited to the wallet.`
    : money?.method === "manual" && amount > 0 ? ` Manual refund $${amount.toFixed(2)} recorded.`
    : "";
  return {
    success: true,
    message: (order.commissionPaid
      ? `Refund #${refundNumber} processed.${how} Rep clawback: $${done.salesRepClawback.toFixed(2)}, Doctor clawback: $${done.physicianClawback.toFixed(2)}.`
      : `Refund #${refundNumber} processed.${how} Commission not yet paid — no clawback applied.`) + wooNote,
  };
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
    const done = await record(order, p, {
      refundNumber: count + 1, amount, method: wallet ? "wallet" : "manual",
      reason: refund.reason || "Refunded in WooCommerce", wooRefundId: refund.id, source: "woocommerce",
    });
    if (done && !wallet && amount > 0) {
      await sendMail({
        to: ALERT_TO, type: "WooCommerce Refund Alert", relatedId: order.orderNumber,
        subject: `Order ${order.orderNumber} refunded in WP admin: refund the card in Stripe`,
        html: `<p>A $${amount.toFixed(2)} refund was made on order ${order.orderNumber} in WP admin. It is recorded in Pronuvia (commission adjusted), but the customer's card was not refunded: do it in the Stripe dashboard, or make refunds from the Pronuvia admin next time.</p>`,
      }).catch((e) => console.error("[refunds] alert email failed:", e));
    }
  }
}
