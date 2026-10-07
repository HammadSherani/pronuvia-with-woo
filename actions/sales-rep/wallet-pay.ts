"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireSalesRep } from "@/lib/auth/dal";
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

export type WalletPayState = {
  success:     boolean;
  orderNumber?: string;
  message?:    string;
} | undefined;

export async function payWithWallet(
  _state: WalletPayState,
  formData: FormData,
): Promise<WalletPayState> {
  const session = await requireSalesRep();

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

  const rep = await prisma.salesRepresentative.findUnique({
    where:  { id: session.userId },
    select: { commission: true, walletBalance: true, email: true, firstName: true, lastName: true },
  });
  if (!rep) return { success: false, message: "Account not found." };

  if (rep.walletBalance < total) {
    return {
      success: false,
      message: `Insufficient wallet balance. Available: $${rep.walletBalance.toFixed(2)}, Required: $${total.toFixed(2)}`,
    };
  }

  const subtotal         = parseFloat(items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2));
  const commissionBase   = parseFloat((subtotal - discountAmount).toFixed(2));
  const commissionRate   = rep.commission;
  const commissionAmount = parseFloat(((commissionBase * commissionRate) / 100).toFixed(2));
  const newBalance       = parseFloat((rep.walletBalance - total).toFixed(2));
  const txId             = `WALLET-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const deliveryDate     = estimatedDeliveryDate(7);

  const orderNumber = await generateOrderNumber();

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.create({
      data: {
        orderNumber,
        salesRepId: session.userId,
        items:      items as object[],
        subtotal,
        total,
        discountAmount: discountAmount || 0,
        couponCode:     couponCode || undefined,
        couponId:       couponId   || undefined,
        salesRepCommissionRate:    commissionRate,
        salesRepCommissionAmount:  commissionAmount,
        physicianCommissionRate:   0,
        physicianCommissionAmount: 0,
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
    prisma.salesRepresentative.update({
      where: { id: session.userId },
      data:  {
        ordersCount:   { increment: 1 },
        walletBalance: newBalance,
      },
    }),
    prisma.walletTransaction.create({
      data: {
        userId:      session.userId,
        userRole:    "SALES_REP",
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

  await syncPendingPayoutRequest(session.userId, "SALES_REP", newBalance);

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
        paymentMethod:   "WALLET",
        billingAddress:  billingAddress  || null,
        shippingAddress: shippingAddress || null,
        notes:           notes           || null,
        orderDate:       new Date(),
        customerPhone:   customerPhone   || null,
      });
      const bcc = rep?.email && rep.email !== customerEmail ? [rep.email] : [];
      await sendMail({ to: customerEmail, bcc: bcc.length ? bcc : undefined, subject, html, type: "Order Confirmation", relatedId: orderNumber });
    } catch (err) {
      console.error("[sales-rep wallet] confirmation email failed:", err);
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
    console.error("[sales-rep wallet] internal notification email failed:", err);
  }

  revalidatePath("/sales/orders");
  return { success: true, orderNumber };
}
