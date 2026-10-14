"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { addWooOrderNote, deleteWooOrderNote, getWooOrderNotes } from "@/lib/woo/orders";

// Notes of orders that are in WooCommerce are Woo order notes (ids "woo:123"),
// including the ones Woo writes itself (stock, status changes). Older orders
// keep their notes here. A customer note is also emailed to the patient below.
const WOO_PREFIX = "woo:";

export type NoteType = "private" | "customer";

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

export async function addOrderNote(
  orderId: string,
  type:    NoteType,
  content: string,
): Promise<{ success: boolean; message?: string }> {
  await requireAdmin();

  const trimmed = content.trim();
  if (!trimmed) return { success: false, message: "Note cannot be empty." };

  const target = await prisma.order.findUnique({ where: { id: orderId }, select: { wooOrderId: true } });
  if (!target) return { success: false, message: "Order not found." };
  if (target.wooOrderId) {
    try {
      await addWooOrderNote(target.wooOrderId, trimmed, type === "customer");
    } catch (e) {
      return { success: false, message: `WooCommerce did not save the note: ${e instanceof Error ? e.message : String(e)}` };
    }
  } else {
    await prisma.orderNote.create({ data: { orderId, type, content: trimmed } });
  }

  if (type === "customer") {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        orderNumber:     true,
        customerEmail:   true,
        shippingAddress: true,
        billingAddress:  true,
        subtotal:        true,
        total:           true,
        shippingRate:    true,
        paymentMethod:   true,
        couponCode:      true,
        discountAmount:  true,
        items:           true,
        physician: { select: { email: true, firstName: true, lastName: true } },
        salesRep:  { select: { email: true } },
      },
    });

    if (order) {
      const { sendMail }       = await import("@/lib/email/mailer");
      const { orderNoteEmail } = await import("@/lib/email/templates");

      type RawItem = { title?: string; variantSize?: string | null; quantity?: number; lineTotal?: number };
      const items = (order.items as RawItem[]).map(i => ({
        title:       i.title       ?? "Product",
        variantSize: i.variantSize ?? null,
        quantity:    i.quantity    ?? 1,
        lineTotal:   i.lineTotal   ?? 0,
      }));

      const orderData = {
        orderNumber:     order.orderNumber,
        note:            trimmed,
        items,
        subtotal:        order.subtotal,
        shippingCost:    order.shippingRate ?? 0,
        couponCode:      order.couponCode   ?? null,
        discountAmount:  order.discountAmount ?? 0,
        total:           order.total,
        paymentMethod:   order.paymentMethod,
        billingAddress:  order.billingAddress,
        shippingAddress: order.shippingAddress,
      };

      const physicianEmail = order.physician?.email ?? null;
      const salesRepEmail  = order.salesRep?.email  ?? null;

      const sends: Promise<unknown>[] = [];

      // Single email to patient — doctor BCC'd, rep CC'd
      if (order.customerEmail) {
        let patientFirstName = "Patient";
        if (order.shippingAddress) {
          try {
            const addr = JSON.parse(order.shippingAddress) as { firstName?: string };
            if (addr?.firstName) patientFirstName = addr.firstName;
          } catch {}
        }
        const patientCc: string[] = [];
        const patientBcc = physicianEmail ? [physicianEmail] : [];
        const { subject, html } = orderNoteEmail({ firstName: patientFirstName, ...orderData });
        sends.push(sendMail({ to: order.customerEmail, cc: patientCc.length ? patientCc : undefined, bcc: patientBcc.length ? patientBcc : undefined, subject, html }));
      } else if (order.physician?.email) {
        // No patient email — send directly to doctor; rep BCC'd so doctor can't see the upline
        const drName = `${order.physician.firstName} ${order.physician.lastName}`.trim();
        const drBcc  = order.salesRep?.email ? [order.salesRep.email] : [];
        const { subject, html } = orderNoteEmail({ firstName: drName, ...orderData });
        sends.push(sendMail({ to: order.physician.email, bcc: drBcc.length ? drBcc : undefined, subject, html }));
      }

      try {
        await Promise.all(sends);
      } catch (err) {
        console.error("[addOrderNote] email failed:", err);
      }
    }
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function deleteOrderNote(
  noteId:  string,
  orderId: string,
): Promise<{ success: boolean }> {
  await requireAdmin();
  if (noteId.startsWith(WOO_PREFIX)) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { wooOrderId: true } });
    if (!order?.wooOrderId) return { success: false };
    try {
      await deleteWooOrderNote(order.wooOrderId, Number(noteId.slice(WOO_PREFIX.length)));
    } catch (e) {
      console.error("[order-notes] WooCommerce note not deleted:", e);
      return { success: false };
    }
  } else {
    await prisma.orderNote.delete({ where: { id: noteId, orderId } });
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
