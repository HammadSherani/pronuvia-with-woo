"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requirePhysician } from "@/lib/auth/dal";
import { estimatedDeliveryDate } from "@/lib/utils/shipping";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { validateCartItemsAvailability } from "@/lib/orders/validate-items";
import { sendMail } from "@/lib/email/mailer";
import { orderConfirmationEmail, newOrderNotificationEmail } from "@/lib/email/templates";
import { syncPendingPayoutRequest } from "@/lib/withdrawals/sync";

type CartItem = {
  productId:   string;
  title:       string;
  variantSize: string;
  sku:         string;
  unitPrice:   number;
  quantity:    number;
  lineTotal:   number;
};

export type PhysicianWalletPayState = {
  success:      boolean;
  orderNumber?: string;
  message?:     string;
} | undefined;

export async function payWithPhysicianWallet(
  _state: PhysicianWalletPayState,
  formData: FormData,
): Promise<PhysicianWalletPayState> {
  const session = await requirePhysician();

  const itemsRaw        = (formData.get("items")           as string) || "[]";
  const shippingAddress = (formData.get("shippingAddress") as string) || undefined;
  const billingAddress  = (formData.get("billingAddress")  as string) || undefined;
  const shippingRate    = parseFloat((formData.get("shippingRate")    as string) || "0");
  const shippingMethod  = (formData.get("shippingMethod")  as string) || undefined;
  const total           = parseFloat((formData.get("total")           as string) || "0");
  const notes           = (formData.get("notes")           as string) || undefined;
  const couponCode      = (formData.get("couponCode")      as string) || undefined;
  const couponId        = (formData.get("couponId")        as string) || undefined;
  const discountAmount  = parseFloat((formData.get("discountAmount")  as string) || "0");
  const customerEmail   = (formData.get("customerEmail")   as string) || undefined;
  const customerPhone   = (formData.get("customerPhone")   as string) || undefined;

  let items: CartItem[];
  try {
    items = JSON.parse(itemsRaw) as CartItem[];
  } catch {
    return { success: false, message: "Invalid cart data." };
  }
  if (!items.length) return { success: false, message: "Cart is empty." };

  const availability = await validateCartItemsAvailability(items);
  if (!availability.valid) return { success: false, message: availability.message };

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: session.userId },
    select: {
      commission:      true,
      uplineCommission: true,
      walletBalance:   true,
      salesRepId:      true,
      email:           true,
      firstName:       true,
      lastName:        true,
    },
  });
  if (!physician) return { success: false, message: "Account not found." };

  if (physician.walletBalance < total) {
    return {
      success: false,
      message: `Insufficient wallet balance. Available: $${physician.walletBalance.toFixed(2)}, Required: $${total.toFixed(2)}`,
    };
  }

  const subtotal                   = parseFloat(items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2));
  const commissionBase             = parseFloat((subtotal - discountAmount).toFixed(2));
  const physicianCommissionRate    = physician.commission ?? 0;
  const physicianCommissionAmount  = parseFloat(((commissionBase * physicianCommissionRate) / 100).toFixed(2));

  let salesRepCommissionRate   = 0;
  let salesRepCommissionAmount = 0;
  if (physician.salesRepId) {
    salesRepCommissionRate   = physician.uplineCommission ?? 0;
    salesRepCommissionAmount = parseFloat(((commissionBase * salesRepCommissionRate) / 100).toFixed(2));
  }

  const newBalance   = parseFloat((physician.walletBalance - total).toFixed(2));
  const txId         = `WALLET-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const deliveryDate = estimatedDeliveryDate(7);
  const orderNumber  = await generateOrderNumber();

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.create({
      data: {
        orderNumber,
        physicianId: session.userId,
        salesRepId:  physician.salesRepId ?? null,
        items:       items as object[],
        subtotal,
        total,
        discountAmount: discountAmount || 0,
        couponCode:     couponCode || undefined,
        couponId:       couponId   || undefined,
        physicianCommissionRate,
        physicianCommissionAmount,
        salesRepCommissionRate,
        salesRepCommissionAmount,
        customerEmail,
        customerPhone,
        shippingAddress,
        billingAddress,
        shippingRate,
        shippingMethod,
        estimatedDelivery: deliveryDate,
        paymentMethod:  "WALLET",
        paymentStatus:  "PAID",
        transactionId:  txId,
        notes,
      },
    }),
    prisma.partneringPhysician.update({
      where: { id: session.userId },
      data:  {
        ordersCount:   { increment: 1 },
        walletBalance: newBalance,
      },
    }),
    prisma.walletTransaction.create({
      data: {
        userId:      session.userId,
        userRole:    "PHYSICIAN",
        amount:      total,
        type:        "DEBIT",
        description: `Order ${orderNumber}`,
        balance:     newBalance,
      },
    }),
  ];

  if (couponId) {
    ops.push(
      prisma.coupon.update({
        where: { id: couponId },
        data:  { usedCount: { increment: 1 } },
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(ops as any);

  await syncPendingPayoutRequest(session.userId, "PHYSICIAN", newBalance);

  if (customerEmail) {
    try {
      const { subject, html } = orderConfirmationEmail({
        orderNumber,
        firstName:       physician.firstName ?? "Doctor",
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
        couponCode:      couponCode      || null,
        discountAmount:  discountAmount  || 0,
        paymentMethod:   "WALLET",
        billingAddress:  billingAddress  || null,
        shippingAddress: shippingAddress || null,
        notes:           notes           || null,
        orderDate:       new Date(),
        customerPhone:   customerPhone   || null,
        doctorFirstName: physician.firstName || null,
        doctorLastName:  physician.lastName  || null,
      });
      const bcc = physician.email !== customerEmail ? [physician.email] : [];
      await sendMail({ to: customerEmail, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Confirmation", relatedId: orderNumber });
    } catch (err) {
      console.error("[physician wallet] confirmation email failed:", err);
    }
  }

  try {
    const orderedBy      = [physician.firstName, physician.lastName].filter(Boolean).join(" ") || "Doctor";
    const { subject, html } = newOrderNotificationEmail({
      orderNumber,
      orderedBy,
      orderDate:       new Date(),
      items:           items.map((i) => ({ title: i.title, variantSize: i.variantSize, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal,
      shippingCost:    shippingRate,
      couponCode:      couponCode     || null,
      discountAmount:  discountAmount || 0,
      paymentMethod:   "WALLET",
      total,
      billingAddress:  billingAddress  || null,
      shippingAddress: shippingAddress || null,
      contactEmail:    customerEmail   || null,
      contactPhone:    customerPhone   || null,
    });
    await sendMail({ to: "sales1.pronuvia@gmail.com", subject, html });
  } catch (err) {
    console.error("[physician wallet] internal notification email failed:", err);
  }

  revalidatePath("/physician/orders");
  return { success: true, orderNumber };
}
