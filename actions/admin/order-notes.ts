"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { getWooOrderNotes } from "@/lib/woo/orders";

// Notes of orders that are in WooCommerce are Woo order notes (ids "woo:123"),
// including the ones Woo writes itself (stock, status changes). Older orders
// keep their notes here. Notes are added and removed in WP admin.
const WOO_PREFIX = "woo:";

export type OrderNoteRow = {
  id:        string;
  type:      string;
  content:   string;
  createdAt: Date;
};

export async function getOrderNotes(orderId: string): Promise<OrderNoteRow[]> {
  await requireAdmin();
  const [order, local] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, select: { wooOrderId: true } }),
    prisma.orderNote.findMany({
      where:   { orderId },
      orderBy: { createdAt: "asc" },
      select:  { id: true, type: true, content: true, createdAt: true },
    }),
  ]);
  if (!order?.wooOrderId) return local;

  try {
    const woo = await getWooOrderNotes(order.wooOrderId);
    const rows: OrderNoteRow[] = woo.map((n) => ({
      id:        `${WOO_PREFIX}${n.id}`,
      type:      n.customer_note ? "customer" : "private",
      content:   n.note.replace(/<[^>]*>/g, ""),
      createdAt: new Date(`${n.date_created_gmt}Z`),
    }));
    return [...local, ...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (e) {
    console.error("[order-notes] WooCommerce notes could not be loaded:", e);
    return local;
  }
}
