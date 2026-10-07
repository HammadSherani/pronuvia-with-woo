"use server";

import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export type { AddressData } from "@/components/shared/address-fields";
import type { AddressData } from "@/components/shared/address-fields";

export async function saveCheckoutAddress(data: {
  shipping: AddressData;
  billing:  AddressData;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const session = await requireSalesRep();
    await prisma.salesRepresentative.update({
      where: { id: session.userId },
      data: {
        shippingAddress: JSON.stringify(data.shipping),
        billingAddress:  JSON.stringify(data.billing),
      },
    });
    revalidatePath("/sales/checkout");
    return { success: true };
  } catch {
    return { success: false, message: "Failed to save address." };
  }
}
