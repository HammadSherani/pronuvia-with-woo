"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { OrderStatus } from "@/generated/prisma/enums";
import { sendMail } from "@/lib/email/mailer";
import { orderRefundEmail } from "@/lib/email/templates";
import { syncPendingPayoutRequest } from "@/lib/withdrawals/sync";
import { getCurrentPeriod } from "@/lib/withdrawals/monthly";
import { applyStatusLocally, pushOrderToWoo, refreshOrderFromWoo, META } from "@/lib/orders/order-woo";
import { STATUS_META_KEY } from "@/lib/orders/woo-status";
import { trashWooOrder, updateWooOrders } from "@/lib/woo/orders";

const wooFailed = (e: unknown) =>
  `WooCommerce did not accept the change: ${e instanceof Error ? e.message : String(e)}`;

export type OrderActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

export type OrderItem = {
  productId: string;
  title: string;
  variantSize: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};



export type ShipOrderPayload = {
  carrier:          string;
  trackingNumber:   string;
  shippingCost:     number;
  estimatedDelivery: string; // ISO date string yyyy-mm-dd
};

export async function shipOrder(
  orderId: string,
  payload: ShipOrderPayload,
): Promise<OrderActionState> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true, status: true,
      orderNumber: true, items: true,
      customerEmail: true, customerPhone: true,
      shippingAddress: true, billingAddress: true,
      total: true, shippingRate: true, paymentMethod: true,
      couponCode: true, discountAmount: true,
      physician: { select: { email: true, firstName: true, lastName: true } },
      salesRep:  { select: { email: true } },
    },
  });
  if (!order) return { message: "Order not found." };

  const estimatedDelivery = payload.estimatedDelivery ? new Date(payload.estimatedDelivery) : null;

  const trackingNumber = payload.trackingNumber.trim();
  try {
    await pushOrderToWoo(orderId, {
      status: OrderStatus.SHIPPED,
      meta:   { [META.trackingNumber]: trackingNumber || null, [META.carrier]: payload.carrier || null },
      note:   `Shipped${payload.carrier ? ` with ${payload.carrier}` : ""}${trackingNumber ? `, tracking ${trackingNumber}` : ""}.`,
    });
  } catch (e) {
    return { message: wooFailed(e) };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status:           OrderStatus.SHIPPED,
      shippingCarrier:  payload.carrier || null,
      trackingNumber:   payload.trackingNumber.trim() || null,
      shippingRate:     payload.shippingCost,
      estimatedDelivery,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/sales/orders");
  revalidatePath("/physician/orders");

  // Send tracking email
  const trackingNum = payload.trackingNumber.trim();
  if (trackingNum) {
    try {
      const { shipmentTrackingEmail } = await import("@/lib/email/templates");
      type RawItem = { title?: string; variantSize?: string; quantity?: number; lineTotal?: number };
      const items = (order.items as RawItem[]).map(i => ({
        title:       i.title       ?? "Product",
        variantSize: i.variantSize ?? null,
        quantity:    i.quantity    ?? 1,
        lineTotal:   i.lineTotal   ?? 0,
      }));
      const { subject, html } = shipmentTrackingEmail({
        orderNumber:      order.orderNumber,
        trackingNumber:   trackingNum,
        shippingCarrier:  payload.carrier || null,
        estimatedDelivery,
        items,
        shippingAddress:  order.shippingAddress,
        billingAddress:   order.billingAddress,
        total:            order.total,
        shippingCost:     order.shippingRate ?? 0,
        couponCode:       order.couponCode   ?? null,
        discountAmount:   order.discountAmount ?? 0,
        paymentMethod:    order.paymentMethod,
        contactEmail:     order.customerEmail ?? null,
        contactPhone:     order.customerPhone ?? null,
      });

      const to = order.customerEmail ?? order.physician?.email ?? "";
      const toIsPatient = !!order.customerEmail;
      const cc  = [toIsPatient ? null : order.physician?.email, toIsPatient ? null : order.salesRep?.email, "sales1.pronuvia@gmail.com"].filter(Boolean) as string[];
      const bcc = toIsPatient && order.physician?.email ? [order.physician.email] : [];

      if (to) await sendMail({ to, cc, bcc: bcc.length ? bcc : undefined, subject, html });
    } catch (err) {
      console.error("[shipOrder] tracking email failed:", err);
    }
  }

  return { success: true, message: "Order marked as shipped." };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<OrderActionState> {
  await requireAdmin();

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) return { message: "Order not found." };

  // WooCommerce first; ours only once Woo took it
  try {
    await pushOrderToWoo(id, { status });
  } catch (e) {
    return { message: wooFailed(e) };
  }
  await applyStatusLocally(id, status);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/withdrawals");
  revalidatePath("/sales/wallet");
  revalidatePath("/physician/wallet");
  return { success: true, message: "Order status updated." };
}

export async function deleteOrder(id: string): Promise<OrderActionState> {
  await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { message: "Order not found." };

  // The Woo order goes to the WP trash, where it can still be restored
  if (order.wooOrderId) {
    try {
      await trashWooOrder(order.wooOrderId);
    } catch (e) {
      return { message: wooFailed(e) };
    }
  }

  // Decrement counters
  await Promise.all([
    prisma.order.delete({ where: { id } }),
    ...(order.physicianId
      ? [prisma.partneringPhysician.update({
          where: { id: order.physicianId },
          data: { ordersCount: { decrement: 1 } },
        })]
      : []),
    ...(order.salesRepId
      ? [prisma.salesRepresentative.update({
          where: { id: order.salesRepId },
          data: { ordersCount: { decrement: 1 } },
        })]
      : []),
  ]);

  revalidatePath("/admin/orders");
  return { success: true, message: "Order deleted." };
}

export async function listOrders(opts?: { skip?: number; take?: number; status?: string; q?: string }) {
  await requireAdmin();
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status as OrderStatus;
  if (opts?.q) {
    // Order number, WooCommerce order number (#124), patient (name / email in
    // the shipping address), physician or rep name
    const q = opts.q.trim();
    const has = { contains: q, mode: "insensitive" as const };
    const wooId = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
    where.OR = [
      { orderNumber: has },
      ...(wooId !== null ? [{ wooOrderId: wooId }] : []),
      { customerEmail: has },
      { shippingAddress: has },
      { physician: { is: { OR: [{ firstName: has }, { lastName: has }, { nameOfPractice: has }, { email: has }] } } },
      { salesRep:  { is: { OR: [{ name: has }, { email: has }] } } },
    ];
  }
  const whereArg = Object.keys(where).length ? where : undefined;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: whereArg,
      select: {
        id: true, orderNumber: true, status: true, total: true,
        items: true,
        subtotal: true, placedByAdmin: true, placedBySalesRep: true, commissionPaid: true,
        salesRepCommissionRate: true, salesRepCommissionAmount: true,
        physicianCommissionRate: true, physicianCommissionAmount: true,
        paymentMethod: true, paymentStatus: true, transactionId: true,
        shippingCarrier: true, trackingNumber: true, shippingRate: true, estimatedDelivery: true,
        returnedAt: true, returnedTotal: true,
        salesRepClawback: true, physicianClawback: true,
        shippingAddress: true,
        customerEmail: true,
        physician: { select: { firstName: true, lastName: true, nameOfPractice: true, email: true } },
        salesRep:  { select: { name: true, email: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.order.count({ where: whereArg }),
  ]);
  return { orders, total };
}

// Commission is credited automatically by the monthly period-close sweep
// (lib/withdrawals/commission-sweep.ts), keyed off each order's creation
// date — not by this action. This is now purely a bulk fulfillment-status
// update; it has no wallet side effects.
export async function bulkCompleteOrders(orderIds: string[]): Promise<OrderActionState> {
  await requireAdmin();
  if (!orderIds.length) return { message: "No orders selected." };

  const eligible = await prisma.order.findMany({
    where: {
      id:     { in: orderIds },
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.REFUNDED, OrderStatus.CANCELLED] },
    },
    select: { id: true, wooOrderId: true },
  });

  // WooCommerce first, in one batch; only what Woo accepted is completed here
  const inWoo = eligible.filter((o) => o.wooOrderId);
  let accepted = new Set<number>();
  if (inWoo.length) {
    try {
      accepted = await updateWooOrders(inWoo.map((o) => ({
        id: o.wooOrderId!, status: "completed", meta_data: [{ key: STATUS_META_KEY, value: OrderStatus.COMPLETED }],
      })));
    } catch (e) {
      return { message: wooFailed(e) };
    }
  }
  const done = eligible.filter((o) => !o.wooOrderId || accepted.has(o.wooOrderId));
  const result = await prisma.order.updateMany({
    where: { id: { in: done.map((o) => o.id) } },
    data:  { status: OrderStatus.COMPLETED },
  });
  const refused = eligible.length - done.length;

  revalidatePath("/admin/orders");

  const skipped = orderIds.length - result.count;
  return {
    success: true,
    message: `${result.count} order${result.count !== 1 ? "s" : ""} marked as Completed.${skipped - refused > 0 ? ` ${skipped - refused} skipped (already completed/refunded/cancelled).` : ""}${refused > 0 ? ` ${refused} not changed: WooCommerce refused them.` : ""}`,
  };
}

export async function getOrderById(id: string) {
  await requireAdmin();
  // Changes made in WP admin show up here
  await refreshOrderFromWoo({ id });
  return prisma.order.findUnique({
    where: { id },
    include: {
      physician: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          nameOfPractice: true, commission: true,
          phone: true, addressOne: true, addressTwo: true, city: true, state: true, zipCode: true,
          walletBalance: true,
        },
      },
      salesRep: {
        select: {
          id: true, name: true, firstName: true, lastName: true, email: true,
          phone: true, commission: true, billingAddress: true,
          walletBalance: true,
        },
      },
    },
  });
}

export type OrderEmailType =
  | "new_order"
  | "cancelled_order"
  | "processing_order"
  | "completed_order"
  | "order_details";

export async function sendOrderEmail(
  orderId: string,
  emailType: OrderEmailType
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true, total: true, status: true, items: true,
      trackingNumber: true, shippingCarrier: true, estimatedDelivery: true,
      shippingRate: true, shippingAddress: true, billingAddress: true,
      paymentMethod: true, customerEmail: true, customerPhone: true,
      couponCode: true, discountAmount: true,
      physician: { select: { email: true, firstName: true, lastName: true } },
      salesRep:  { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!order) return { success: false, message: "Order not found." };

  // Derive recipient name: physician → patient from shipping address → sales rep
  let recipientFirstName = order.physician?.firstName ?? "Customer";
  if (!order.physician && order.shippingAddress) {
    try {
      const addr = JSON.parse(order.shippingAddress) as { firstName?: string };
      if (addr.firstName) recipientFirstName = addr.firstName;
    } catch { /* use default */ }
  }

  const label: Record<OrderEmailType, string> = {
    new_order:        "New Order",
    cancelled_order:  "Cancelled Order",
    processing_order: "Processing Order",
    completed_order:  "Completed Order",
    order_details:    "Order Details",
  };

  type RawItem = { title?: string; variantSize?: string; quantity?: number; unitPrice?: number; lineTotal?: number };
  const items = (order.items as RawItem[]).map((i) => ({
    title:       i.title       ?? "Product",
    variantSize: i.variantSize,
    quantity:    i.quantity    ?? 1,
    unitPrice:   i.unitPrice   ?? 0,
    lineTotal:   i.lineTotal   ?? 0,
  }));

  // Primary recipient: customerEmail (patient) → physician email → sales rep email
  const primaryEmail = order.customerEmail ?? order.physician?.email ?? order.salesRep?.email ?? "";
  if (!primaryEmail) return { success: false, message: "No recipient email found for this order." };

  const emailData = {
    orderNumber:       order.orderNumber,
    firstName:         recipientFirstName,
    total:             order.total,
    status:            order.status,
    items,
    trackingNumber:    order.trackingNumber,
    shippingCarrier:   order.shippingCarrier,
    estimatedDelivery: order.estimatedDelivery,
    shippingCost:      order.shippingRate ?? 0,
    couponCode:        order.couponCode   ?? null,
    discountAmount:    order.discountAmount ?? 0,
    shippingAddress:   order.shippingAddress,
    billingAddress:    order.billingAddress,
    paymentMethod:     order.paymentMethod,
    email:             primaryEmail,
    customerPhone:     order.customerPhone,
  };

  const {
    orderConfirmationEmail, orderProcessingEmail, orderCompletedEmail,
    orderCancelledEmail, orderDetailsEmail,
  } = await import("@/lib/email/templates");
  const { sendMail } = await import("@/lib/email/mailer");

  const templateFns: Record<OrderEmailType, (d: typeof emailData) => { subject: string; html: string }> = {
    new_order:        orderConfirmationEmail,
    processing_order: orderProcessingEmail,
    completed_order:  orderCompletedEmail,
    cancelled_order:  orderCancelledEmail,
    order_details:    orderDetailsEmail,
  };

  const { subject, html } = templateFns[emailType](emailData);

  const toEmail = primaryEmail;
  // Physician in BCC when sending to patient; sales rep + internal stay in CC
  const sendingToPatient = !!order.customerEmail && toEmail === order.customerEmail;
  const ccEmails = [sendingToPatient ? null : order.physician?.email, sendingToPatient ? null : order.salesRep?.email]
    .filter((e): e is string => !!e && e !== toEmail);
  const ccList  = [...new Set(ccEmails)];
  const bccEmails = sendingToPatient && order.physician?.email ? [order.physician.email] : [];

  // Map email type → order status (only for status-bearing emails)
  const statusMap: Partial<Record<OrderEmailType, string>> = {
    processing_order: "PROCESSING",
    completed_order:  "COMPLETED",
    cancelled_order:  "CANCELLED",
  };

  try {
    await sendMail({ to: toEmail, cc: ccList.length ? ccList : undefined, bcc: bccEmails.length ? bccEmails : undefined, subject, html });

    const newStatus = statusMap[emailType] as OrderStatus | undefined;
    if (newStatus) {
      try {
        await pushOrderToWoo(orderId, { status: newStatus });
      } catch (e) {
        return { success: false, message: `Email sent, but the status was not changed. ${wooFailed(e)}` };
      }
      await applyStatusLocally(orderId, newStatus);
      revalidatePath(`/admin/orders/${orderId}`);
      revalidatePath("/admin/orders");
    }

    const statusNote = newStatus ? ` Order status updated to ${newStatus.charAt(0) + newStatus.slice(1).toLowerCase()}.` : "";
    return { success: true, message: `"${label[emailType]}" email sent to ${toEmail}.${statusNote}` };
  } catch (err) {
    console.error("[sendOrderEmail]", err);
    const sgErr = err as { response?: { body?: { errors?: { message?: string }[] } } };
    const providerMessage = sgErr.response?.body?.errors?.[0]?.message;
    return {
      success: false,
      message: providerMessage
        ? `Failed to send email: ${providerMessage}`
        : "Failed to send email. Check SMTP settings.",
    };
  }
}

export async function getOrderByNumber(orderNumber: string) {
  await requireAdmin();
  return prisma.order.findUnique({
    where: { orderNumber: orderNumber.trim().toUpperCase() },
    select: {
      id: true, orderNumber: true, status: true,
      total: true, subtotal: true, items: true,
      salesRepId: true, physicianId: true,
      salesRepCommissionAmount: true, salesRepCommissionRate: true,
      physicianCommissionAmount: true, physicianCommissionRate: true,
      commissionPaid: true,
      returnedAt: true,
      salesRep: { select: { id: true, name: true, walletBalance: true } },
      physician: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export type ReturnActionState = {
  success?: boolean;
  message?: string;
} | undefined;

export type RefundLineItem   = { index: number; returnedQty: number };
export type StoredRefundItem = { index: number; returnedQty: number; lineTotal: number };
export type CustomerRefundPayload = {
  method: "manual" | "stripe";
  amount: number;
};

export async function processReturn(
  orderId:        string,
  returnedLines:  RefundLineItem[] | null,  // null = full refund of all remaining
  reason:         string,
  customerRefund?: CustomerRefundPayload,
): Promise<ReturnActionState> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true, orderNumber: true, status: true, total: true, subtotal: true, items: true,
      salesRepId: true, physicianId: true,
      salesRepCommissionAmount: true, physicianCommissionAmount: true,
      commissionPaid: true,
      returnedAt: true, returnedTotal: true, returnReason: true,
      salesRepClawback: true, physicianClawback: true,
      stripePaymentIntentId: true,
      customerEmail: true, customerPhone: true, shippingRate: true, paymentMethod: true, createdAt: true,
      billingAddress: true, shippingAddress: true, notes: true,
      couponCode: true, discountAmount: true,
      salesRep:  { select: { walletBalance: true, email: true } },
      physician: { select: { walletBalance: true, email: true, firstName: true } },
    },
  });

  if (!order) return { message: "Order not found." };

  const items = order.items as unknown as OrderItem[];

  // ── Load existing refunds to compute already-refunded quantities ─────────
  const existingRefunds = await prisma.orderRefund.findMany({
    where:   { orderId },
    orderBy: { processedAt: "asc" },
  });

  const refundedQtyByIdx = new Map<number, number>();
  for (const r of existingRefunds) {
    if (!r.items) {
      items.forEach((item, idx) => refundedQtyByIdx.set(idx, item.quantity));
    } else {
      for (const ri of r.items as StoredRefundItem[]) {
        refundedQtyByIdx.set(ri.index, (refundedQtyByIdx.get(ri.index) ?? 0) + ri.returnedQty);
      }
    }
  }

  const remainingByIdx = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    remainingByIdx.set(i, Math.max(0, items[i].quantity - (refundedQtyByIdx.get(i) ?? 0)));
  }

  const totalRemaining = Array.from(remainingByIdx.values()).reduce((s, v) => s + v, 0);
  if (totalRemaining === 0) return { message: "All items on this order have already been refunded." };

  // ── Determine lines to process ───────────────────────────────────────────
  let linesToProcess: { index: number; returnedQty: number }[];
  let isFullThisRefund: boolean;

  if (returnedLines === null) {
    linesToProcess = items
      .map((_, idx) => ({ index: idx, returnedQty: remainingByIdx.get(idx) ?? 0 }))
      .filter(l => l.returnedQty > 0);
    isFullThisRefund = true;
  } else {
    const activeLines = returnedLines.filter(rl => rl.returnedQty > 0);
    if (activeLines.length === 0) return { message: "No items selected for refund." };

    for (const line of activeLines) {
      const remaining = remainingByIdx.get(line.index) ?? 0;
      if (line.returnedQty > remaining) {
        return { message: `Item #${line.index + 1} exceeds remaining refundable quantity (${remaining}).` };
      }
    }

    linesToProcess = activeLines;
    isFullThisRefund = items.every((_, idx) => {
      const remaining = remainingByIdx.get(idx) ?? 0;
      if (remaining === 0) return true;
      const line = linesToProcess.find(l => l.index === idx);
      return !!line && line.returnedQty >= remaining;
    });
  }

  // ── Build stored items and compute event total ───────────────────────────
  const storedRefundItems: StoredRefundItem[] = linesToProcess.map(rl => {
    const item  = items[rl.index];
    const r     = item ? rl.returnedQty / item.quantity : 0;
    return {
      index:       rl.index,
      returnedQty: rl.returnedQty,
      lineTotal:   parseFloat(((item?.lineTotal ?? 0) * r).toFixed(2)),
    };
  });

  const eventTotal = parseFloat(
    storedRefundItems.reduce((s, ri) => s + ri.lineTotal, 0).toFixed(2)
  );
  if (eventTotal <= 0) return { message: "Refund amount is zero." };

  // ── Commission clawback for this event ───────────────────────────────────
  const existingSalesRepClawback  = order.salesRepClawback  ?? 0;
  const existingPhysicianClawback = order.physicianClawback ?? 0;
  const remainingSalesRepCommission  = Math.max(0, order.salesRepCommissionAmount  - existingSalesRepClawback);
  const remainingPhysicianCommission = Math.max(0, order.physicianCommissionAmount - existingPhysicianClawback);

  const denominator = order.subtotal > 0 ? order.subtotal : order.total;
  const salesRepClawback  = isFullThisRefund
    ? remainingSalesRepCommission
    : parseFloat(Math.min(remainingSalesRepCommission, order.salesRepCommissionAmount * Math.min(1.0, eventTotal / denominator)).toFixed(2));
  const physicianClawback = isFullThisRefund
    ? remainingPhysicianCommission
    : parseFloat(Math.min(remainingPhysicianCommission, order.physicianCommissionAmount * Math.min(1.0, eventTotal / denominator)).toFixed(2));

  const refundNumber = existingRefunds.length + 1;

  // ── Customer payment refund (Stripe or manual) ──────────────────────────
  let stripeRefundId: string | null = null;

  if (customerRefund && customerRefund.amount > 0) {
    if (customerRefund.method === "stripe") {
      if (!order.stripePaymentIntentId) {
        return { message: "No Stripe payment on this order — cannot process Stripe refund." };
      }
      const { stripe } = await import("@/lib/stripe/server");
      if (!stripe) {
        return { message: "Stripe is not configured on this server." };
      }
      try {
        const stripeRefund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount:         Math.round(customerRefund.amount * 100),
        });
        stripeRefundId = stripeRefund.id;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Stripe refund failed.";
        return { message: `Stripe error: ${msg}` };
      }
    }
    // "manual" — no external call, just record it below
  }

  // ── Create OrderRefund record ────────────────────────────────────────────
  // recordedTotal = actual amount back to customer (items + shipping if included)
  // eventTotal (items-only) is kept separate for commission clawback math
  const recordedTotal = (customerRefund?.amount && customerRefund.amount > 0)
    ? customerRefund.amount
    : eventTotal;

  await prisma.orderRefund.create({
    data: {
      orderId,
      refundNumber,
      items:                storedRefundItems as object[],
      total:                recordedTotal,
      salesRepClawback,
      physicianClawback,
      reason:               reason.trim() || null,
      customerRefundMethod: customerRefund?.amount && customerRefund.amount > 0 ? customerRefund.method : null,
      customerRefundAmount: customerRefund?.amount && customerRefund.amount > 0 ? customerRefund.amount : null,
      stripeRefundId:       stripeRefundId || null,
    },
  });

  // ── Commission clawback (negative balance allowed) ───────────────────────
  // Dated to the CURRENT period (not the order's original period) so it
  // nets against whatever new commission is earned this period.
  if (order.commissionPaid) {
    const payoutTimeZone = process.env.PAYOUT_TIMEZONE ?? "UTC";
    const currentPeriod  = getCurrentPeriod(new Date(), payoutTimeZone);

    if (order.salesRepId && salesRepClawback > 0) {
      const currentBalance = order.salesRep?.walletBalance ?? 0;
      const newBalance     = parseFloat((currentBalance - salesRepClawback).toFixed(2));
      await prisma.salesRepresentative.update({
        where: { id: order.salesRepId },
        data:  { walletBalance: newBalance },
      });
      await prisma.walletTransaction.create({
        data: {
          userId:      order.salesRepId,
          userRole:    "SALES_REP",
          amount:      salesRepClawback,
          type:        "DEBIT",
          description: `Commission clawback — refund #${refundNumber} on order #${order.orderNumber}`,
          orderId,
          periodKey:   currentPeriod.key,
          balance:     newBalance,
        },
      });
      await syncPendingPayoutRequest(order.salesRepId, "SALES_REP", newBalance);
    }

    if (order.physicianId && physicianClawback > 0) {
      const currentBalance = order.physician?.walletBalance ?? 0;
      const newBalance     = parseFloat((currentBalance - physicianClawback).toFixed(2));
      await prisma.partneringPhysician.update({
        where: { id: order.physicianId },
        data:  { walletBalance: newBalance },
      });
      await prisma.walletTransaction.create({
        data: {
          userId:      order.physicianId,
          userRole:    "PHYSICIAN",
          amount:      physicianClawback,
          type:        "DEBIT",
          description: `Commission clawback — refund #${refundNumber} on order #${order.orderNumber}`,
          orderId,
          periodKey:   currentPeriod.key,
          balance:     newBalance,
        },
      });
      await syncPendingPayoutRequest(order.physicianId, "PHYSICIAN", newBalance);
    }
  }

  // ── Inventory restore ────────────────────────────────────────────────────
  await Promise.all(linesToProcess.map(async rl => {
    const item = items[rl.index];
    if (!item?.productId || !rl.returnedQty) return;
    // Woo-catalog items (numeric ids) are restocked in WooCommerce, not here
    if (!/^[a-f0-9]{24}$/i.test(item.productId)) return;
    try {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) return;
      type Variant = { sku?: string; stock?: number; [key: string]: unknown };
      const variants = (product.variants ?? []) as Variant[];
      const vIdx     = variants.findIndex(v => v.sku && item.sku && v.sku === item.sku);
      if (vIdx !== -1) {
        variants[vIdx] = { ...variants[vIdx], stock: (variants[vIdx].stock ?? 0) + rl.returnedQty };
        const newTotal = variants.reduce((s, v) => s + (v.stock ?? 0), 0);
        await prisma.product.update({
          where: { id: item.productId },
          data:  { variants: variants as object[], quantity: newTotal },
        });
      } else {
        await prisma.product.update({
          where: { id: item.productId },
          data:  { quantity: { increment: rl.returnedQty } },
        });
      }
    } catch (e) {
      console.error(`[Inventory Restore] product ${item.productId}:`, e);
    }
  }));

  // ── Update order aggregate fields ────────────────────────────────────────
  const newReturnedTotal     = parseFloat(((order.returnedTotal ?? 0) + recordedTotal).toFixed(2));
  const newSalesRepClawback  = parseFloat((existingSalesRepClawback + salesRepClawback).toFixed(2));
  const newPhysicianClawback = parseFloat((existingPhysicianClawback + physicianClawback).toFixed(2));

  // The refund already happened, so a Woo failure must not stop this; the
  // order page sends the status again the next time it is opened
  if (isFullThisRefund) {
    await pushOrderToWoo(orderId, { status: OrderStatus.REFUNDED }).catch((e) =>
      console.error(`[processReturn] order ${order.orderNumber}: status not sent to WooCommerce:`, e));
  }

  await prisma.order.update({
    where: { id: orderId },
    data:  {
      status:            (isFullThisRefund ? "REFUNDED" : order.status) as OrderStatus,
      returnedAt:        order.returnedAt ?? new Date(),
      returnReason:      reason.trim() || order.returnReason || null,
      returnedTotal:     newReturnedTotal,
      salesRepClawback:  newSalesRepClawback,
      physicianClawback: newPhysicianClawback,
      ...(isFullThisRefund && { commissionPaid: false }),
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/withdrawals");
  revalidatePath("/sales/wallet");
  revalidatePath("/physician/wallet");

  const customerNote = stripeRefundId
    ? ` Stripe refund $${customerRefund!.amount.toFixed(2)} sent.`
    : customerRefund?.method === "manual" && (customerRefund.amount ?? 0) > 0
    ? ` Manual refund $${customerRefund.amount.toFixed(2)} recorded.`
    : "";

  // Send refund confirmation email to patient, CC doctor / sales rep
  if (order.customerEmail || order.physician?.email || order.salesRep?.email) {
    try {
      const refundedItems = linesToProcess.map((l) => {
        const item = items[l.index];
        return {
          title:       item.title,
          variantSize: item.variantSize,
          quantity:    l.returnedQty,
          unitPrice:   item.unitPrice,
          lineTotal:   parseFloat((item.unitPrice * l.returnedQty).toFixed(2)),
        };
      });
      const { subject, html } = orderRefundEmail({
        orderNumber:     order.orderNumber,
        orderDate:       order.createdAt,
        refundAmount:    customerRefund?.amount ?? eventTotal,
        reason:          reason.trim() || null,
        note:            reason.trim() || null,
        items:           refundedItems,
        subtotal:        order.subtotal,
        shippingCost:    order.shippingRate ?? 0,
        couponCode:      order.couponCode      ?? null,
        discountAmount:  order.discountAmount  ?? 0,
        paymentMethod:   order.paymentMethod ?? null,
        billingAddress:  order.billingAddress ?? null,
        shippingAddress: order.shippingAddress ?? null,
        contactEmail:    order.customerEmail ?? null,
        contactPhone:    order.customerPhone ?? null,
      });

      const refundTo = order.customerEmail ?? order.physician?.email ?? "";
      if (refundTo) {
        const refundToIsPatient = !!order.customerEmail;
        const refundCc = [refundToIsPatient ? null : order.physician?.email, refundToIsPatient ? null : order.salesRep?.email]
          .filter((e): e is string => !!e && e !== refundTo);
        const refundCcUnique = [...new Set(refundCc)];
        const refundBcc = refundToIsPatient && order.physician?.email ? [order.physician.email] : [];
        await sendMail({ to: refundTo, cc: refundCcUnique.length ? refundCcUnique : undefined, bcc: refundBcc.length ? refundBcc : undefined, subject, html });
      }
    } catch (err) {
      console.error("[processReturn] refund email failed:", err);
    }
  }

  return {
    success: true,
    message: order.commissionPaid
      ? `Refund #${refundNumber} processed.${customerNote} Rep clawback: $${salesRepClawback.toFixed(2)}, Doctor clawback: $${physicianClawback.toFixed(2)}.`
      : `Refund #${refundNumber} processed.${customerNote} Commission not yet paid — no clawback applied.`,
  };
}

export async function getOrderRefunds(orderId: string) {
  await requireAdmin();
  return prisma.orderRefund.findMany({
    where:   { orderId },
    orderBy: { processedAt: "asc" },
  });
}

export async function getCommissionSummary(opts?: { salesRepId?: string; physicianId?: string }) {
  await requireAdmin();
  const where = opts?.salesRepId
    ? { salesRepId: opts.salesRepId }
    : opts?.physicianId
    ? { physicianId: opts.physicianId }
    : {};

  const orders = await prisma.order.findMany({
    where,
    select: {
      salesRepCommissionRate: true, salesRepCommissionAmount: true,
      physicianCommissionRate: true, physicianCommissionAmount: true,
      total: true, status: true, createdAt: true, orderNumber: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalSalesRepCommission   = orders.reduce((s, o) => s + o.salesRepCommissionAmount,  0);
  const totalPhysicianCommission  = orders.reduce((s, o) => s + o.physicianCommissionAmount, 0);
  const totalRevenue              = orders.reduce((s, o) => s + o.total, 0);

  return { orders, totalSalesRepCommission, totalPhysicianCommission, totalRevenue };
}

