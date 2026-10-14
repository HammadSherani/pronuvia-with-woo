import "server-only";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { wooFetch } from "./client";
import type { WooMeta } from "./types";

// Coupons live in WooCommerce (WP admin → Marketing → Coupons, or the admin
// Coupons page here). Woo checks the amount, minimum spend and expiry when a
// coupon is applied to the cart. Two rules Woo can't check are ours:
//
// - Who may use it: Woo has no Sales Rep / Physician roles, so the coupon
//   carries meta `pronuvia_applicable_to` (ALL, SALES_REP or PHYSICIAN).
//   Missing meta = ALL, so coupons made in WP admin work for everyone.
// - Usage limit: until orders are created in Woo (Phase 6) Woo's own
//   usage_count stays 0, so uses are also counted from our orders. The higher
//   of the two counts, so nothing is counted twice once Woo takes over.

export type CouponRole = "SALES_REP" | "PHYSICIAN";
export type ApplicableTo = "ALL" | CouponRole;

export type WooCoupon = {
  id:             number;
  code:           string;
  amount:         string;
  discount_type:  "percent" | "fixed_cart" | "fixed_product";
  description:    string;
  status:         string;       // publish = active, draft = inactive
  date_created_gmt: string;
  date_expires_gmt: string | null;
  usage_count:    number;
  usage_limit:    number | null;
  minimum_amount: string;
  meta_data:      WooMeta[];
};

export const APPLICABLE_TO_KEY = "pronuvia_applicable_to";

export function applicableTo(c: WooCoupon): ApplicableTo {
  const v = c.meta_data.find((m) => m.key === APPLICABLE_TO_KEY)?.value;
  return v === "SALES_REP" || v === "PHYSICIAN" ? v : "ALL";
}

/** Uses of each coupon (lowercase code) in our own orders; cancelled ones don't count. */
export async function couponUsesInOrders(code?: string): Promise<Map<string, number>> {
  const rows = await prisma.order.groupBy({
    by:     ["couponCode"],
    where:  {
      couponCode: code ? { equals: code, mode: "insensitive" } : { not: null },
      status:     { not: OrderStatus.CANCELLED },
    },
    _count: { _all: true },
  });
  const uses = new Map<string, number>();
  for (const r of rows) {
    if (!r.couponCode) continue;
    const key = r.couponCode.toLowerCase();
    uses.set(key, (uses.get(key) ?? 0) + r._count._all);
  }
  return uses;
}

// `?code=` only ever finds published coupons, and lists leave drafts out
// unless asked, so look a code up by search and match it exactly
export async function findCoupon(code: string): Promise<WooCoupon | null> {
  const wanted = code.trim().toLowerCase();
  const { data } = await wooFetch<WooCoupon[]>(`wc/v3/coupons?search=${encodeURIComponent(wanted)}&status=any&per_page=100`);
  return data.find((c) => c.code.toLowerCase() === wanted) ?? null;
}

const WHO: Record<CouponRole, string> = { SALES_REP: "sales representatives", PHYSICIAN: "physicians" };

/**
 * The checks Woo can't do for us. Returns an error message, or null when the
 * coupon may go to Woo (which then checks amount, minimum spend and expiry).
 */
export async function checkCouponAccess(code: string, role: CouponRole): Promise<string | null> {
  const coupon = await findCoupon(code);
  if (!coupon)                     return "Coupon not found.";
  if (coupon.status !== "publish") return "This coupon is no longer active.";

  const to = applicableTo(coupon);
  if (to !== "ALL" && to !== role) return `This coupon is only available to ${WHO[to]}.`;

  if (coupon.usage_limit !== null) {
    const ours = (await couponUsesInOrders(coupon.code)).get(coupon.code) ?? 0;
    if (Math.max(coupon.usage_count, ours) >= coupon.usage_limit) {
      return "This coupon has reached its usage limit.";
    }
  }
  return null;
}
