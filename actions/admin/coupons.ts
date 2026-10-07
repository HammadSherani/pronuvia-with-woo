"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { prisma }       from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { parseDateOnlyEndOfDayInTZ } from "@/lib/utils/timezone";

export type CouponInput = {
  code:           string;
  description?:   string;
  discountType:   "PERCENTAGE" | "FIXED";
  discountValue:  number;
  minOrderAmount?: number | null;
  maxUses?:        number | null;
  expiresAt?:      string | null;
  isActive:        boolean;
  applicableTo:    "ALL" | "SALES_REP" | "PHYSICIAN";
};

export type CouponRecord = {
  id: string; code: string; description: string | null;
  discountType: string; discountValue: number;
  minOrderAmount: number | null; maxUses: number | null; usedCount: number;
  expiresAt: Date | null; isActive: boolean; applicableTo: string; createdAt: Date;
};

export type CouponActionResult =
  | { success: true;  message: string; coupon: CouponRecord }
  | { success: false; message: string; coupon?: never };

export async function getCoupons() {
  await requireAdmin();
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCoupon(input: CouponInput): Promise<CouponActionResult> {
  await requireAdmin();

  const code = input.code.trim().toUpperCase();
  if (!code) return { success: false, message: "Code is required." };
  if (input.discountValue <= 0) return { success: false, message: "Discount value must be positive." };
  if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
    return { success: false, message: "Percentage discount cannot exceed 100%." };
  }

  const exists = await prisma.coupon.findUnique({ where: { code } });
  if (exists) return { success: false, message: `Coupon code "${code}" already exists.` };

  const coupon = await prisma.coupon.create({
    data: {
      code,
      description:    input.description?.trim() || undefined,
      discountType:   input.discountType,
      discountValue:  input.discountValue,
      minOrderAmount: input.minOrderAmount ?? undefined,
      maxUses:        input.maxUses        ?? undefined,
      expiresAt:      input.expiresAt ? parseDateOnlyEndOfDayInTZ(input.expiresAt) : undefined,
      isActive:       input.isActive,
      applicableTo:   input.applicableTo,
    },
  });

  revalidatePath("/admin/coupons");
  return { success: true, message: `Coupon "${code}" created.`, coupon };
}

export async function updateCoupon(id: string, input: Partial<CouponInput>): Promise<CouponActionResult> {
  await requireAdmin();

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      description:    input.description?.trim() || undefined,
      discountType:   input.discountType,
      discountValue:  input.discountValue,
      minOrderAmount: input.minOrderAmount ?? null,
      maxUses:        input.maxUses        ?? null,
      expiresAt:      input.expiresAt ? parseDateOnlyEndOfDayInTZ(input.expiresAt) : null,
      isActive:       input.isActive,
      applicableTo:   input.applicableTo,
    },
  });

  revalidatePath("/admin/coupons");
  return { success: true, message: "Coupon updated.", coupon };
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<CouponActionResult> {
  await requireAdmin();
  const coupon = await prisma.coupon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/coupons");
  return { success: true, message: isActive ? "Coupon activated." : "Coupon deactivated.", coupon };
}

export async function deleteCoupon(id: string): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/coupons");
  return { success: true, message: "Coupon deleted." };
}
