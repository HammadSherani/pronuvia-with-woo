"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";

export type NoteType = "private" | "customer";

export type OrderNoteRow = {
  id:        string;
  type:      string;
  content:   string;
  createdAt: Date;
};

export async function getOrderNotes(orderId: string): Promise<OrderNoteRow[]> {
  await requireAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes = await (prisma as any).orderNote.findMany({
    where:   { orderId },
    orderBy: { createdAt: "asc" },
    select:  { id: true, type: true, content: true, createdAt: true },
  });
  return notes as OrderNoteRow[];
}

export async function addOrderNote(
  orderId: string,
  type:    NoteType,
  content: string,
): Promise<{ success: boolean; message?: string }> {
  await requireAdmin();

  const trimmed = content.trim();
  if (!trimmed) return { success: false, message: "Note cannot be empty." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).orderNote.create({
    data: { orderId, type, content: trimmed },
  });

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).orderNote.delete({ where: { id: noteId } });
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
