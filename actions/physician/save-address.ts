"use server";

import { requirePhysician } from "@/lib/auth/dal";
import { prisma }           from "@/lib/db/prisma";
import { scheduleWooCustomerSync } from "@/lib/woo/customers";

export async function savePhysicianAddress(data: {
  address1: string; address2: string;
  city: string; state: string; zip: string;
  country: string; phone?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const session = await requirePhysician();
    await prisma.partneringPhysician.update({
      where: { id: session.userId },
      data: {
        addressOne: data.address1,
        addressTwo: data.address2 || undefined,
        city:       data.city,
        state:      data.state,
        zipCode:    data.zip,
        country:    data.country || undefined,
        phone:      data.phone   || undefined,
      },
    });
    scheduleWooCustomerSync("PHYSICIAN", session.userId);
    return { success: true };
  } catch {
    return { success: false, message: "Failed to save address." };
  }
}
