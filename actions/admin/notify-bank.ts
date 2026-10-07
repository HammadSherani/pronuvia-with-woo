"use server";

import { prisma }        from "@/lib/db/prisma";
import { requireAdmin }  from "@/lib/auth/dal";

export async function notifyUserAddBank(
  userId:   string,
  userRole: "PHYSICIAN" | "SALES_REP",
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();

  try {
    if (userRole === "PHYSICIAN") {
      await prisma.partneringPhysician.update({
        where: { id: userId },
        data:  { bankNotifyRequested: true },
      });
    } else {
      await prisma.salesRepresentative.update({
        where: { id: userId },
        data:  { bankNotifyRequested: true },
      });
    }
    return { success: true, message: "User notified." };
  } catch {
    return { success: false, message: "Failed to notify user." };
  }
}
