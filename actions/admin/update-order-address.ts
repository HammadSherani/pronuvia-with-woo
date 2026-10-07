"use server";

import { prisma }        from "@/lib/db/prisma";
import { requireAdmin }  from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";

export type OrderAddrField = {
  firstName:   string;
  lastName:    string;
  phone:       string;
  address1:    string;
  address2:    string;
  city:        string;
  state:       string;
  stateName:   string;
  zip:         string;
  country:     string;
  countryName: string;
};

export async function updateOrderAddress(
  orderId: string,
  type: "billing" | "shipping",
  addr: OrderAddrField,
): Promise<{ success: boolean; message?: string }> {
  await requireAdmin();

  const field = type === "billing" ? "billingAddress" : "shippingAddress";

  await prisma.order.update({
    where: { id: orderId },
    data:  { [field]: JSON.stringify(addr) },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function updateOrderCustomerPhone(
  orderId: string,
  phone: string,
): Promise<{ success: boolean; message?: string }> {
  await requireAdmin();

  await prisma.order.update({
    where: { id: orderId },
    data:  { customerPhone: phone || null },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function updateOrderCustomerEmail(
  orderId: string,
  email: string,
): Promise<{ success: boolean; message?: string }> {
  await requireAdmin();

  await prisma.order.update({
    where: { id: orderId },
    data:  { customerEmail: email || null },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
