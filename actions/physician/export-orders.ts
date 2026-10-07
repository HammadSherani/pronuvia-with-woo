"use server";

import { prisma } from "@/lib/db/prisma";
import { requirePhysician } from "@/lib/auth/dal";
import { formatDate } from "@/lib/utils/timezone";

export type PhysicianOrderExportRow = {
  orderNumber:     string;
  date:            string;
  status:          string;
  paymentStatus:   string;
  paymentMethod:   string;
  billingName:     string;
  billingAddress:  string;
  shippingName:    string;
  shippingAddress: string;
  items:           string;
  subtotal:        number;
  shippingCost:    number;
  total:           number;
  carrier:         string;
  trackingNumber:  string;
};

type OrderItem = {
  title:       string;
  variantSize: string;
  quantity:    number;
};

function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() ?? "";
}

export async function getPhysicianOrdersForExport(): Promise<PhysicianOrderExportRow[]> {
  const session = await requirePhysician();

  const orders = await prisma.order.findMany({
    where:   { physicianId: session.userId },
    select: {
      orderNumber:     true,
      createdAt:       true,
      status:          true,
      paymentStatus:   true,
      paymentMethod:   true,
      billingAddress:  true,
      shippingAddress: true,
      items:           true,
      subtotal:        true,
      shippingRate:    true,
      total:           true,
      shippingCarrier: true,
      trackingNumber:  true,
      physician: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => {
    const itemList = (o.items as unknown as OrderItem[])
      .map((i) => `${i.title}${i.variantSize ? ` (${i.variantSize})` : ""} × ${i.quantity}`)
      .join("; ");

    // Billing: use what was entered at checkout; fall back to physician name if missing
    const billingAddr = o.billingAddress ?? "";
    const billingName = billingAddr
      ? firstLine(billingAddr)
      : `${o.physician?.firstName ?? ""} ${o.physician?.lastName ?? ""}`.trim();

    return {
      orderNumber:     o.orderNumber,
      date:            formatDate(o.createdAt),
      status:          o.status,
      paymentStatus:   o.paymentStatus ?? "",
      paymentMethod:   o.paymentMethod ?? "",
      billingName,
      billingAddress:  billingAddr,
      shippingName:    firstLine(o.shippingAddress ?? ""),
      shippingAddress: o.shippingAddress ?? "",
      items:           itemList,
      subtotal:        o.subtotal,
      shippingCost:    o.shippingRate,
      total:           o.total,
      carrier:         o.shippingCarrier ?? "",
      trackingNumber:  o.trackingNumber  ?? "",
    };
  });
}
