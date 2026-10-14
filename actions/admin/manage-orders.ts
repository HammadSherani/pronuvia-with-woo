"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { OrderStatus } from "@/generated/prisma/enums";
import { applyStatusLocally, pushOrderToWoo, refreshOrderFromWoo, META } from "@/lib/orders/order-woo";
import { STATUS_META_KEY } from "@/lib/orders/woo-status";
import { trashWooOrder, updateWooOrders } from "@/lib/woo/orders";
import { sendTrackingEmail } from "@/lib/orders/tracking-email";
import { refundOrder } from "@/lib/orders/refunds";

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

  if (trackingNumber) {
    try {
      await sendTrackingEmail(orderId, { number: trackingNumber, carrier: payload.carrier || null, estimatedDelivery });
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
  method: "manual" | "stripe" | "wallet";
  amount: number;
};

// Refunds and returns: money back (Stripe, the wallet, or by hand), our
// record and commission clawback, and the WooCommerce refund (restocks).
export async function processReturn(
  orderId:        string,
  returnedLines:  RefundLineItem[] | null,  // null = full refund of all remaining
  reason:         string,
  customerRefund?: CustomerRefundPayload,
): Promise<ReturnActionState> {
  await requireAdmin();

  const res = await refundOrder(orderId, returnedLines, reason, customerRefund);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/withdrawals");
  revalidatePath("/sales/wallet");
  revalidatePath("/physician/wallet");
  return res.success ? { success: true, message: res.message } : { message: res.message };
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

