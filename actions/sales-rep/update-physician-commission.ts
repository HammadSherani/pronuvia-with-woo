"use server";

import { requireSalesRep } from "@/lib/auth/dal";

export async function updatePhysicianCommission(
  _physicianId: string,
  _commission: number,
): Promise<{ success: boolean; message: string }> {
  await requireSalesRep();
  return { success: false, message: "Only admin can set physician commission." };
}
