"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma }       from "@/lib/db/prisma";

// Labels are bought in WP admin with the WooCommerce Shipping plugin now
// (lib/orders/woo-labels.ts). Labels bought earlier with the custom FedEx /
// UPS / USPS integration are kept as Shipment records and shown read-only.
export async function getOrderShipments(orderId: string) {
  await requireAdmin();
  return prisma.shipment.findMany({
    where:   { orderId },
    orderBy: { createdAt: "asc" },
  });
}
