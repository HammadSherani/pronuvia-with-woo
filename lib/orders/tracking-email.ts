import "server-only";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { shipmentTrackingEmail } from "@/lib/email/templates";

const INTERNAL = "sales1.pronuvia@gmail.com";

/**
 * The "your order has shipped" email: to the patient with the physician in
 * BCC, or, when the order has no patient email, to the physician with the rep
 * in CC. The team is always copied.
 */
export async function sendTrackingEmail(
  orderId: string,
  tracking: { number: string; carrier: string | null; estimatedDelivery?: Date | null },
): Promise<void> {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      orderNumber: true, items: true,
      customerEmail: true, customerPhone: true,
      shippingAddress: true, billingAddress: true,
      total: true, shippingRate: true, paymentMethod: true,
      couponCode: true, discountAmount: true,
      physician: { select: { email: true } },
      salesRep:  { select: { email: true } },
    },
  });
  if (!order) return;

  type RawItem = { title?: string; variantSize?: string; quantity?: number; lineTotal?: number };
  const { subject, html } = shipmentTrackingEmail({
    orderNumber:       order.orderNumber,
    trackingNumber:    tracking.number,
    shippingCarrier:   tracking.carrier,
    estimatedDelivery: tracking.estimatedDelivery ?? null,
    items: (order.items as RawItem[]).map((i) => ({
      title:       i.title       ?? "Product",
      variantSize: i.variantSize ?? null,
      quantity:    i.quantity    ?? 1,
      lineTotal:   i.lineTotal   ?? 0,
    })),
    shippingAddress: order.shippingAddress,
    billingAddress:  order.billingAddress,
    total:           order.total,
    shippingCost:    order.shippingRate ?? 0,
    couponCode:      order.couponCode   ?? null,
    discountAmount:  order.discountAmount ?? 0,
    paymentMethod:   order.paymentMethod,
    contactEmail:    order.customerEmail ?? null,
    contactPhone:    order.customerPhone ?? null,
  });

  const to = order.customerEmail ?? order.physician?.email ?? "";
  if (!to) return;
  const toPatient = !!order.customerEmail;
  const cc  = [toPatient ? null : order.physician?.email, toPatient ? null : order.salesRep?.email, INTERNAL].filter(Boolean) as string[];
  const bcc = toPatient && order.physician?.email ? [order.physician.email] : [];

  await sendMail({
    to, cc, bcc: bcc.length ? bcc : undefined, subject, html,
    type: "Shipment Tracking", relatedId: order.orderNumber,
  });
}
