"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { stripe } from "@/lib/stripe/server";
import { requireAdmin } from "@/lib/auth/dal";
import { estimatedDeliveryDate } from "@/lib/utils/shipping";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { validateCartItemsAvailability } from "@/lib/orders/validate-items";
import { sendMail } from "@/lib/email/mailer";
import { orderConfirmationEmail } from "@/lib/email/templates";

type CartItem = {
  productId:   string;
  title:       string;
  variantSize: string;
  sku:         string;
  unitPrice:   number;
  quantity:    number;
  lineTotal:   number;
};

export type ConfirmBehalfOrderPayload = {
  physicianId:     string;
  paymentIntentId: string;
  itemsJson:       string;
  billingAddress:  string;
  shippingAddress: string;
  notes:           string;
  shippingRate:    number;
  shippingMethod?: string;
  total:           number;
  customerEmail?:  string;
  customerPhone?:  string;
  couponId?:       string;
  couponCode?:     string;
  discountAmount?: number;
};

export type ConfirmBehalfOrderResult = {
  success:      boolean;
  orderNumber?: string;
  message?:     string;
};

export async function confirmBehalfCardOrder(
  payload: ConfirmBehalfOrderPayload,
): Promise<ConfirmBehalfOrderResult> {
  await requireAdmin();

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
        placedByAdmin: true,
        physicianId:  payload.physicianId,
        salesRepId:   physician?.salesRepId ?? null,
        items:        items as object[],
        subtotal,
        total:          payload.total,
        discountAmount: payload.discountAmount ?? 0,
        couponCode:     payload.couponCode     || undefined,
        couponId:       payload.couponId       || undefined,
        physicianCommissionRate,
        physicianCommissionAmount,
        salesRepCommissionRate,
        salesRepCommissionAmount,
        customerEmail:         payload.customerEmail   || undefined,
        customerPhone:         payload.customerPhone   || undefined,
        billingAddress:        payload.billingAddress  || undefined,
        shippingAddress:       payload.shippingAddress || undefined,
        shippingRate:          payload.shippingRate,
        shippingMethod:        payload.shippingMethod  || undefined,
        estimatedDelivery:     estimatedDeliveryDate(7),
        paymentMethod:         "CARD",
        paymentStatus:         "PAID",
        transactionId:         pi.id,
        stripePaymentIntentId: pi.id,
        notes:                 payload.notes || undefined,
      },
    }),
    prisma.partneringPhysician.update({
      where: { id: payload.physicianId },
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

  // Send confirmation email to patient; CC physician
  if (payload.customerEmail) {
    try {
      const { subject, html } = orderConfirmationEmail({
        orderNumber,
        firstName:       physician?.firstName ?? "Doctor",
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
        email:           payload.customerEmail   || null,
        customerPhone:   payload.customerPhone   || null,
        doctorFirstName: physician?.firstName    || null,
        doctorLastName:  physician?.lastName      || null,
      });
      const bcc = physician?.email && physician.email !== payload.customerEmail ? [physician.email] : [];
      await sendMail({ to: payload.customerEmail, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Confirmation", relatedId: orderNumber });
    } catch (err) {
      console.error("[behalf order] confirmation email failed:", err);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/physician/orders`);
  return { success: true, orderNumber };
}
