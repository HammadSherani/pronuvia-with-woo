"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendNewOrderToWoo, SYNC } from "@/lib/orders/woo-sync";
import { Prisma } from "@/generated/prisma/client";
import { stripe } from "@/lib/stripe/server";
import { takeCardQuote } from "@/lib/checkout/card-payment";
import { requireAdmin } from "@/lib/auth/dal";
import { estimatedDeliveryDate } from "@/lib/utils/shipping";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { sendMail } from "@/lib/email/mailer";
import { orderConfirmationEmail } from "@/lib/email/templates";

export type ConfirmBehalfOrderPayload = {
  physicianId:     string;
  paymentIntentId: string;
};

export type ConfirmBehalfOrderResult = {
  success:      boolean;
  orderNumber?: string;
  message?:     string;
};

export async function confirmBehalfCardOrder(
  payload: ConfirmBehalfOrderPayload,
): Promise<ConfirmBehalfOrderResult> {
  const session = await requireAdmin();

  if (!stripe) return { success: false, message: "Stripe is not configured on this server." };

  let pi: Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;
  try {
    pi = await stripe.paymentIntents.retrieve(payload.paymentIntentId);
  } catch {
    return { success: false, message: "Could not verify payment. Please contact support." };
  }

  if (pi.status !== "succeeded") {
    return { success: false, message: `Payment not confirmed (status: ${pi.status}).` };
  }
  if (pi.metadata.physicianId !== payload.physicianId) {
    return { success: false, message: "Payment mismatch." };
  }

  const existing = await prisma.order.findFirst({
    where: { stripePaymentIntentId: payload.paymentIntentId },
  });
  if (existing) return { success: true, orderNumber: existing.orderNumber };

  // Everything below comes from the server-side quote this payment was made for
  const quote = await takeCardQuote(pi, session.userId);
  if (!quote.ok) return { success: false, message: quote.message };
  const {
    items, subtotal, total, discountAmount, couponCode, shippingRate, shippingMethod, shippingRateId, taxAmount,
    shippingAddress, billingAddress, notes, customerEmail, customerPhone,
  } = quote.order;

  const commissionBase = parseFloat((subtotal - discountAmount).toFixed(2));

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: payload.physicianId },
    select: { commission: true, uplineCommission: true, salesRepId: true, email: true, firstName: true, lastName: true },
  });
  const physicianCommissionRate   = physician?.commission ?? 0;
  const physicianCommissionAmount = parseFloat(((commissionBase * physicianCommissionRate) / 100).toFixed(2));

  let salesRepCommissionRate   = 0;
  let salesRepCommissionAmount = 0;
  if (physician?.salesRepId) {
    salesRepCommissionRate   = physician.uplineCommission ?? 0;
    salesRepCommissionAmount = parseFloat(((commissionBase * salesRepCommissionRate) / 100).toFixed(2));
  }

  const orderNumber = await generateOrderNumber();

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.create({
      data: {
        orderNumber,
        status: "PROCESSING",
        placedByAdmin: true,
        physicianId:  payload.physicianId,
        salesRepId:   physician?.salesRepId ?? null,
        items:        items as object[],
        subtotal,
        total,
        discountAmount,
        taxAmount,
        shippingRateId,
        wooSyncStatus: SYNC.PENDING,
        couponCode:     couponCode     || undefined,
        physicianCommissionRate,
        physicianCommissionAmount,
        salesRepCommissionRate,
        salesRepCommissionAmount,
        customerEmail:         customerEmail   || undefined,
        customerPhone:         customerPhone   || undefined,
        billingAddress:        billingAddress  || undefined,
        shippingAddress:       shippingAddress || undefined,
        shippingRate,
        shippingMethod:        shippingMethod  || undefined,
        estimatedDelivery:     estimatedDeliveryDate(7),
        paymentMethod:         "CARD",
        paymentStatus:         "PAID",
        transactionId:         pi.id,
        stripePaymentIntentId: pi.id,
        notes:                 notes || undefined,
      },
    }),
    prisma.partneringPhysician.update({
      where: { id: payload.physicianId },
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

  // Send confirmation email to patient; CC physician
  if (customerEmail) {
    try {
      const { subject, html } = orderConfirmationEmail({
        orderNumber,
        firstName:       physician?.firstName ?? "Doctor",
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
        email:           customerEmail   || null,
        customerPhone:   customerPhone   || null,
        doctorFirstName: physician?.firstName    || null,
        doctorLastName:  physician?.lastName      || null,
      });
      const bcc = physician?.email && physician.email !== customerEmail ? [physician.email] : [];
      await sendMail({ to: customerEmail, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Confirmation", relatedId: orderNumber });
    } catch (err) {
      console.error("[behalf order] confirmation email failed:", err);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/physician/orders`);
  return { success: true, orderNumber };
}
