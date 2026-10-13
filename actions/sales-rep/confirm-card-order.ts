"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendNewOrderToWoo, SYNC } from "@/lib/orders/woo-sync";
import { Prisma } from "@/generated/prisma/client";
import { stripe } from "@/lib/stripe/server";
import { takeCardQuote } from "@/lib/checkout/card-payment";
import { requireSalesRep } from "@/lib/auth/dal";
import { estimatedDeliveryDate } from "@/lib/utils/shipping";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { sendMail } from "@/lib/email/mailer";
import { orderConfirmationEmail, newOrderNotificationEmail } from "@/lib/email/templates";

export type ConfirmCardOrderPayload = {
  paymentIntentId: string;
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

  // Everything below comes from the server-side quote this payment was made for
  const quote = await takeCardQuote(pi, session.userId);
  if (!quote.ok) return { success: false, message: quote.message };
  const {
    items, subtotal, total, discountAmount, couponCode, shippingRate, shippingMethod, shippingRateId, taxAmount,
    shippingAddress, billingAddress, notes, customerEmail, customerPhone,
  } = quote.order;

  const commissionBase = parseFloat((subtotal - discountAmount).toFixed(2));

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
        total,
        discountAmount,
        taxAmount,
        shippingRateId,
        wooSyncStatus: SYNC.PENDING,
        couponCode:     couponCode     || undefined,
        salesRepCommissionRate:    commissionRate,
        salesRepCommissionAmount:  commissionAmount,
        physicianCommissionRate:   0,
        physicianCommissionAmount: 0,
        customerEmail:    customerEmail   || undefined,
        customerPhone:    customerPhone   || undefined,
        shippingAddress:  shippingAddress || undefined,
        billingAddress:   billingAddress  || undefined,
        shippingRate,
        shippingMethod:   shippingMethod  || undefined,
        estimatedDelivery: deliveryDate,
        paymentMethod:    "CARD",
        paymentStatus:    "PAID",
        transactionId:    pi.id,
        stripePaymentIntentId: pi.id,
        notes: notes || undefined,
      },
    }),
    prisma.salesRepresentative.update({
      where: { id: session.userId },
      data:  { ordersCount: { increment: 1 } },
    }),
  ];
  ops.push(prisma.checkoutQuote.delete({ where: { id: quote.quoteId } }));

  let created: { id: string };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [created] = (await prisma.$transaction(ops as any)) as [{ id: string }];
  } catch (e) {
    // The same payment confirmed twice at once (double click, or the 3-D
    // Secure return): the quote can only be used once, so the other one won
    const done = await prisma.order.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (done) return { success: true, orderNumber: done.orderNumber };
    throw e;
  }
  // Then into WooCommerce, once the response is sent; a failure is retried
  after(() => sendNewOrderToWoo(created.id));

  if (customerEmail) {
    try {
      const { subject, html } = orderConfirmationEmail({
        orderNumber,
        firstName:       rep?.firstName ?? "Medical Rep",
        total,
        status:          "PAID",
        isPatientEmail:  true,
        items:           items.map((i) => ({
          title:       i.title,
          variantSize: i.variantSize,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          lineTotal:   i.lineTotal,
        })),
        shippingCost:    shippingRate,
        shippingMethod:  shippingMethod  || null,
        couponCode:      couponCode     || null,
        discountAmount:  discountAmount || 0,
        paymentMethod:   "CARD",
        billingAddress:  billingAddress  || null,
        shippingAddress: shippingAddress || null,
        notes:           notes           || null,
        orderDate:       new Date(),
        customerPhone:   customerPhone   || null,
      });
      const bcc = rep?.email && rep.email !== customerEmail ? [rep.email] : [];
      await sendMail({ to: customerEmail, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Confirmation", relatedId: orderNumber });
    } catch (err) {
      console.error("[sales-rep order] confirmation email failed:", err);
    }
  }

  // Internal notification to Pronuvia
  try {
    const orderedBy = [rep?.firstName, rep?.lastName].filter(Boolean).join(" ") || "Medical Rep";
    const { subject, html } = newOrderNotificationEmail({
      orderNumber,
      orderedBy,
      orderDate:       new Date(),
      items:           items.map((i) => ({ title: i.title, variantSize: i.variantSize, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal,
      shippingCost:    shippingRate,
      couponCode:      couponCode     || null,
      discountAmount:  discountAmount || 0,
      paymentMethod:   "CARD",
      total,
      billingAddress:  billingAddress  || null,
      shippingAddress: shippingAddress || null,
      contactEmail:    customerEmail   || null,
      contactPhone:    customerPhone   || null,
    });
    await sendMail({ to: "sales1.pronuvia@gmail.com", subject, html });
  } catch (err) {
    console.error("[sales-rep order] internal notification email failed:", err);
  }

  revalidatePath("/sales/orders");
  return { success: true, orderNumber };
}
