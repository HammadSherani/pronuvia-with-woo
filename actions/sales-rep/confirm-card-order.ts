"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { stripe } from "@/lib/stripe/server";
import { requireSalesRep } from "@/lib/auth/dal";
import { estimatedDeliveryDate } from "@/lib/utils/shipping";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { validateCartItemsAvailability } from "@/lib/orders/validate-items";
import { sendMail } from "@/lib/email/mailer";
import { orderConfirmationEmail, newOrderNotificationEmail } from "@/lib/email/templates";

type CartItem = {
  productId:   string;
  title:       string;
  variantSize: string;
  sku:         string;
  unitPrice:   number;
  quantity:    number;
  lineTotal:   number;
};

export type ConfirmCardOrderPayload = {
  paymentIntentId:  string;
  itemsJson:        string;
  shippingAddress:  string;
  billingAddress?:  string;
  notes:            string;
  shippingRate:     number;
  shippingMethod?:  string;
  total:            number;
  couponId?:        string;
  couponCode?:      string;
  discountAmount?:  number;
  customerEmail?:   string;
  customerPhone?:   string;
};

export type ConfirmCardOrderResult = {
  success:     boolean;
  orderNumber?: string;
  message?:    string;
};

export async function confirmCardOrder(
  payload: ConfirmCardOrderPayload,
): Promise<ConfirmCardOrderResult> {
  const session = await requireSalesRep();

  if (!stripe) return { success: false, message: "Stripe is not configured on this server." };

  // Verify PaymentIntent with Stripe
  let pi: Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;
  try {
    pi = await stripe.paymentIntents.retrieve(payload.paymentIntentId);
  } catch {
    return { success: false, message: "Could not verify payment. Please contact support." };
  }

  if (pi.status !== "succeeded") {
    return { success: false, message: `Payment not confirmed (status: ${pi.status}).` };
  }
  if (pi.metadata.salesRepId !== session.userId) {
    return { success: false, message: "Payment mismatch." };
  }

  // Prevent duplicate order for same payment intent
  const existing = await prisma.order.findFirst({
    where: { stripePaymentIntentId: payload.paymentIntentId },
  });
  if (existing) {
    return { success: true, orderNumber: existing.orderNumber };
  }

  let items: CartItem[];
  try {
    items = JSON.parse(payload.itemsJson) as CartItem[];
  } catch {
    return { success: false, message: "Invalid cart data." };
  }

  const availability = await validateCartItemsAvailability(items);
  if (!availability.valid) return { success: false, message: availability.message };

  const subtotal       = parseFloat(items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2));
  const commissionBase = parseFloat((subtotal - (payload.discountAmount ?? 0)).toFixed(2));

  const rep = await prisma.salesRepresentative.findUnique({
    where:  { id: session.userId },
    select: { commission: true, email: true, firstName: true, lastName: true },
  });
  const commissionRate   = rep?.commission ?? 0;
  const commissionAmount = parseFloat(((commissionBase * commissionRate) / 100).toFixed(2));

  const orderNumber = await generateOrderNumber();

  const deliveryDate = estimatedDeliveryDate(7);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.create({
      data: {
        orderNumber,
        salesRepId: session.userId,
        items:      items as object[],
        subtotal,
        total:          payload.total,
        discountAmount: payload.discountAmount ?? 0,
        couponCode:     payload.couponCode     || undefined,
        couponId:       payload.couponId       || undefined,
        salesRepCommissionRate:    commissionRate,
        salesRepCommissionAmount:  commissionAmount,
        physicianCommissionRate:   0,
        physicianCommissionAmount: 0,
        customerEmail:    payload.customerEmail   || undefined,
        customerPhone:    payload.customerPhone   || undefined,
        shippingAddress:  payload.shippingAddress || undefined,
        billingAddress:   payload.billingAddress  || undefined,
        shippingRate:     payload.shippingRate,
        shippingMethod:   payload.shippingMethod  || undefined,
        estimatedDelivery: deliveryDate,
        paymentMethod:    "CARD",
        paymentStatus:    "PAID",
        transactionId:    pi.id,
        stripePaymentIntentId: pi.id,
        notes: payload.notes || undefined,
      },
    }),
    prisma.salesRepresentative.update({
      where: { id: session.userId },
      data:  { ordersCount: { increment: 1 } },
    }),
  ];

  if (payload.couponId) {
    ops.push(
      prisma.coupon.update({
        where: { id: payload.couponId },
        data:  { usedCount: { increment: 1 } },
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(ops as any);

  if (payload.customerEmail) {
    try {
      const { subject, html } = orderConfirmationEmail({
        orderNumber,
        firstName:       rep?.firstName ?? "Medical Rep",
        total:           payload.total,
        status:          "PAID",
        isPatientEmail:  true,
        items:           items.map((i) => ({
          title:       i.title,
          variantSize: i.variantSize,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          lineTotal:   i.lineTotal,
        })),
        shippingCost:    payload.shippingRate,
        shippingMethod:  payload.shippingMethod  || null,
        couponCode:      payload.couponCode     || null,
        discountAmount:  payload.discountAmount || 0,
        paymentMethod:   "CARD",
        billingAddress:  payload.billingAddress  || null,
        shippingAddress: payload.shippingAddress || null,
        notes:           payload.notes           || null,
        orderDate:       new Date(),
        customerPhone:   payload.customerPhone   || null,
      });
      const bcc = rep?.email && rep.email !== payload.customerEmail ? [rep.email] : [];
      await sendMail({ to: payload.customerEmail, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Confirmation", relatedId: orderNumber });
    } catch (err) {
      console.error("[sales-rep order] confirmation email failed:", err);
    }
  }

  // Internal notification to Pronuvia
  try {
    const orderedBy = [rep?.firstName, rep?.lastName].filter(Boolean).join(" ") || "Medical Rep";
    const subtotal  = items.reduce((s, i) => s + i.lineTotal, 0);
    const { subject, html } = newOrderNotificationEmail({
      orderNumber,
      orderedBy,
      orderDate:       new Date(),
      items:           items.map((i) => ({ title: i.title, variantSize: i.variantSize, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal,
      shippingCost:    payload.shippingRate,
      couponCode:      payload.couponCode     || null,
      discountAmount:  payload.discountAmount || 0,
      paymentMethod:   "CARD",
      total:           payload.total,
      billingAddress:  payload.billingAddress  || null,
      shippingAddress: payload.shippingAddress || null,
      contactEmail:    payload.customerEmail   || null,
      contactPhone:    payload.customerPhone   || null,
    });
    await sendMail({ to: "sales1.pronuvia@gmail.com", subject, html });
  } catch (err) {
    console.error("[sales-rep order] internal notification email failed:", err);
  }

  revalidatePath("/sales/orders");
  return { success: true, orderNumber };
}
