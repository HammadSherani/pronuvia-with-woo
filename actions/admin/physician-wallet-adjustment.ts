"use server";

import { adjustWallet } from "@/actions/admin/wallet-adjustment";

export async function adjustPhysicianWallet(data: {
  userId:   string;
  userRole: "SALES_REP" | "PHYSICIAN";
  type:     "CREDIT" | "DEBIT";
  amount:   number;
  note:     string;
}): Promise<{ success: boolean; message: string }> {
  return adjustWallet(data);
}
