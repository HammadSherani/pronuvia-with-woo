"use server";

import { prisma }          from "@/lib/db/prisma";
import { requireSalesRep } from "@/lib/auth/dal";
import { formatDate }      from "@/lib/utils/timezone";

export type SalesRepOrderExportRow = {
  orderNumber:     string;
  date:            string;
  doctor:          string;
  patientName:     string;
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
  commissionRate:  number;
  commission:      number;
  carrier:         string;
  trackingNumber:  string;
};

type OrderItem = { title: string; variantSize?: string; quantity: number };

function parseName(raw: string | null): string {
  if (!raw) return "";
  try {
    const a = JSON.parse(raw) as { firstName?: string; lastName?: string };
    return [a.firstName, a.lastName].filter(Boolean).join(" ");
  } catch { return raw.split("\n")[0]?.trim() ?? ""; }
}

export async function getSalesRepOrdersForExport(): Promise<SalesRepOrderExportRow[]> {
  const session = await requireSalesRep();

  const orders = await prisma.order.findMany({
    where:   { salesRepId: session.userId },
    select: {
      orderNumber:              true,
      createdAt:                true,
      status:                   true,
      paymentStatus:            true,
      paymentMethod:            true,
      billingAddress:           true,
      shippingAddress:          true,
      items:                    true,
      subtotal:                 true,
      shippingRate:             true,
      total:                    true,
      salesRepCommissionRate:   true,
      salesRepCommissionAmount: true,
      shippingCarrier:          true,
      trackingNumber:           true,
      physician: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => {
    const itemList = (o.items as unknown as OrderItem[])
      .map((i) => `${i.title}${i.variantSize ? ` (${i.variantSize})` : ""} × ${i.quantity}`)
      .join("; ");

    const billingName    = parseName(o.billingAddress);
    const shippingName   = parseName(o.shippingAddress);
    const doctorName     = o.physician
      ? `${o.physician.firstName} ${o.physician.lastName}`
      : "";

    return {
      orderNumber:     o.orderNumber,
      date:            formatDate(o.createdAt),
      doctor:          doctorName,
      patientName:     shippingName,
      status:          o.status,
      paymentStatus:   o.paymentStatus ?? "",
      paymentMethod:   o.paymentMethod ?? "",
      billingName,
      billingAddress:  o.billingAddress  ?? "",
      shippingName,
      shippingAddress: o.shippingAddress ?? "",
      items:           itemList,
      subtotal:        o.subtotal,
      shippingCost:    o.shippingRate,
      total:           o.total,
      commissionRate:  o.salesRepCommissionRate,
      commission:      o.salesRepCommissionAmount,
      carrier:         o.shippingCarrier ?? "",
      trackingNumber:  o.trackingNumber  ?? "",
    };
  });
}
