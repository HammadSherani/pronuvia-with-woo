"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import { parseDateOnlyEndOfDayInTZ } from "@/lib/utils/timezone";
import { wooFetch, WooError } from "@/lib/woo/client";
import {
  APPLICABLE_TO_KEY, applicableTo, couponUsesInOrders, findCoupon, type WooCoupon,
} from "@/lib/woo/coupons";

// Coupons are WooCommerce coupons. This page keeps the Pronuvia fields; the
// same coupons can also be edited in WP admin (Marketing → Coupons).

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

const gmt = (s: string | null) => (s ? new Date(`${s}Z`) : null);

function toRecord(c: WooCoupon, uses: Map<string, number>): CouponRecord {
  const minimum = Number(c.minimum_amount || 0);
  return {
    id:             String(c.id),
    code:           c.code.toUpperCase(),
    description:    c.description || null,
    discountType:   c.discount_type === "percent" ? "PERCENTAGE" : "FIXED",
    discountValue:  Number(c.amount),
    minOrderAmount: minimum > 0 ? minimum : null,
    maxUses:        c.usage_limit,
    usedCount:      Math.max(c.usage_count, uses.get(c.code) ?? 0),
    expiresAt:      gmt(c.date_expires_gmt),
    isActive:       c.status === "publish",
    applicableTo:   applicableTo(c),
    createdAt:      gmt(c.date_created_gmt) ?? new Date(0),
  };
}

// The Woo fields for our form values
function toWoo(input: Partial<CouponInput>) {
  return {
    ...(input.discountType  !== undefined && { discount_type: input.discountType === "PERCENTAGE" ? "percent" : "fixed_cart" }),
    ...(input.discountValue !== undefined && { amount: String(input.discountValue) }),
    ...(input.description   !== undefined && { description: input.description.trim() }),
    ...("minOrderAmount" in input && { minimum_amount: input.minOrderAmount ? String(input.minOrderAmount) : "" }),
    ...("maxUses"        in input && { usage_limit: input.maxUses || null }),
    // Woo ignores date_expires_gmt on write and keeps the expiry on null;
    // date_expires takes a UTC time ("…Z"), and "" removes the expiry
    ...("expiresAt"      in input && {
      date_expires: input.expiresAt ? `${parseDateOnlyEndOfDayInTZ(input.expiresAt).toISOString().slice(0, 19)}Z` : "",
    }),
    ...(input.isActive     !== undefined && { status: input.isActive ? "publish" : "draft" }),
    ...(input.applicableTo !== undefined && { meta_data: [{ key: APPLICABLE_TO_KEY, value: input.applicableTo }] }),
  };
}

function validate(input: Partial<CouponInput>): string | null {
  if (input.discountValue !== undefined && !(input.discountValue > 0)) return "Discount value must be positive.";
  if (input.discountType === "PERCENTAGE" && (input.discountValue ?? 0) > 100) {
    return "Percentage discount cannot exceed 100%.";
  }
  return null;
}

async function record(c: WooCoupon) {
  return toRecord(c, await couponUsesInOrders(c.code));
}

const failed = (e: unknown, fallback: string): CouponActionResult => {
  console.error("[admin coupons]", e);
  return { success: false, message: e instanceof WooError ? e.message : fallback };
};

export async function getCoupons(): Promise<CouponRecord[]> {
  await requireAdmin();
  const all: WooCoupon[] = [];
  for (let page = 1; ; page++) {
    const { data } = await wooFetch<WooCoupon[]>(`wc/v3/coupons?per_page=100&page=${page}&orderby=date&order=desc&status=any`);
    all.push(...data);
    if (data.length < 100) break;
  }
  const uses = await couponUsesInOrders();
  return all.map((c) => toRecord(c, uses));
}

export async function createCoupon(input: CouponInput): Promise<CouponActionResult> {
  await requireAdmin();

  const code = input.code.trim().toUpperCase();
  if (!code) return { success: false, message: "Code is required." };
  const invalid = validate(input);
  if (invalid) return { success: false, message: invalid };

  try {
    if (await findCoupon(code)) return { success: false, message: `Coupon code "${code}" already exists.` };
    // Woo matches codes without case; it keeps them lowercase
    const { data } = await wooFetch<WooCoupon>("wc/v3/coupons", {
      method: "POST",
      body:   { code: code.toLowerCase(), ...toWoo(input) },
    });
    revalidatePath("/admin/coupons");
    return { success: true, message: `Coupon "${code}" created.`, coupon: await record(data) };
  } catch (e) {
    return failed(e, "Could not create the coupon in WooCommerce.");
  }
}

export async function updateCoupon(id: string, input: Partial<CouponInput>): Promise<CouponActionResult> {
  await requireAdmin();
  const invalid = validate(input);
  if (invalid) return { success: false, message: invalid };

  try {
    // toWoo leaves the code out: renaming a coupon would break order history
    const { data } = await wooFetch<WooCoupon>(`wc/v3/coupons/${Number(id)}`, { method: "PUT", body: toWoo(input) });
    revalidatePath("/admin/coupons");
    return { success: true, message: "Coupon updated.", coupon: await record(data) };
  } catch (e) {
    return failed(e, "Could not update the coupon in WooCommerce.");
  }
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<CouponActionResult> {
  await requireAdmin();
  try {
    const { data } = await wooFetch<WooCoupon>(`wc/v3/coupons/${Number(id)}`, {
      method: "PUT",
      body:   { status: isActive ? "publish" : "draft" },
    });
    revalidatePath("/admin/coupons");
    return { success: true, message: isActive ? "Coupon activated." : "Coupon deactivated.", coupon: await record(data) };
  } catch (e) {
    return failed(e, "Could not update the coupon in WooCommerce.");
  }
}

export async function deleteCoupon(id: string): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  try {
    await wooFetch(`wc/v3/coupons/${Number(id)}?force=true`, { method: "DELETE" });
    revalidatePath("/admin/coupons");
    return { success: true, message: "Coupon deleted." };
  } catch (e) {
    console.error("[admin coupons]", e);
    return { success: false, message: e instanceof WooError ? e.message : "Could not delete the coupon in WooCommerce." };
  }
}
