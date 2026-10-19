"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { wooFetch } from "@/lib/woo/client";
import { applicableTo, couponUsesInOrders, type WooCoupon } from "@/lib/woo/coupons";

// Coupons are WooCommerce coupons, created and changed in WP admin
// (Marketing → Coupons). The Pronuvia admin only lists them, with their uses
// in Pronuvia orders.

export type CouponRecord = {
  id: string; code: string; description: string | null;
  discountType: string; discountValue: number;
  minOrderAmount: number | null; maxUses: number | null; usedCount: number;
  expiresAt: Date | null; isActive: boolean; applicableTo: string; createdAt: Date;
};

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
