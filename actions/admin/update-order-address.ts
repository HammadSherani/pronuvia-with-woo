"use server";

import { prisma }        from "@/lib/db/prisma";
import { requireAdmin }  from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import { META, pushOrderToWoo } from "@/lib/orders/order-woo";

// Each change goes to the WooCommerce order first; ours only once Woo took it
async function toWoo(orderId: string, changes: Parameters<typeof pushOrderToWoo>[1]): Promise<string | null> {
  try {
    await pushOrderToWoo(orderId, changes);
    return null;
  } catch (e) {
    return `WooCommerce did not accept the change: ${e instanceof Error ? e.message : String(e)}`;
  }
}

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
  const json  = JSON.stringify(addr);

  const failed = await toWoo(orderId, { [type]: json });
  if (failed) return { success: false, message: failed };

  await prisma.order.update({
    where: { id: orderId },
    data:  { [field]: json },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function updateOrderCustomerPhone(
  orderId: string,
  phone: string,
): Promise<{ success: boolean; message?: string }> {
  await requireAdmin();

  const failed = await toWoo(orderId, { meta: { [META.customerPhone]: phone || null } });
  if (failed) return { success: false, message: failed };

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

  const failed = await toWoo(orderId, { meta: { [META.customerEmail]: email || null } });
  if (failed) return { success: false, message: failed };

  await prisma.order.update({
    where: { id: orderId },
    data:  { customerEmail: email || null },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
