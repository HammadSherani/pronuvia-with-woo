"use server";

import { prisma } from "@/lib/db/prisma";

export type ValidateCouponResult =
  | { valid: true;  couponId: string; code: string; discountAmount: number; message: string }
  | { valid: false; message: string };

export async function validateCoupon(
  code:       string,
  userRole:   "SALES_REP" | "PHYSICIAN",
  orderTotal: number,
): Promise<ValidateCouponResult> {
  const upper = code.trim().toUpperCase();
  if (!upper) return { valid: false, message: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code: upper } });

  if (!coupon)         return { valid: false, message: "Coupon not found." };
  if (!coupon.isActive) return { valid: false, message: "This coupon is no longer active." };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { valid: false, message: "This coupon has expired." };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: "This coupon has reached its usage limit." };
  }
  if (coupon.applicableTo !== "ALL" && coupon.applicableTo !== userRole) {
    const who = coupon.applicableTo === "SALES_REP" ? "sales representatives" : "physicians";
    return { valid: false, message: `This coupon is only available to ${who}.` };
  }
  if (coupon.minOrderAmount !== null && orderTotal < coupon.minOrderAmount) {
    return {
      valid: false,
      message: `Minimum order of $${coupon.minOrderAmount.toFixed(2)} required for this coupon.`,
    };
  }

  let discountAmount: number;
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = parseFloat(((orderTotal * coupon.discountValue) / 100).toFixed(2));
  } else {
    discountAmount = Math.min(coupon.discountValue, orderTotal);
  }

  const label =
    coupon.discountType === "PERCENTAGE"
      ? `${coupon.discountValue}% off`
      : `$${coupon.discountValue.toFixed(2)} off`;

  return {
    valid: true,
    couponId:       coupon.id,
    code:           coupon.code,
    discountAmount,
    message:        `"${coupon.code}" applied — ${label}`,
  };
}
