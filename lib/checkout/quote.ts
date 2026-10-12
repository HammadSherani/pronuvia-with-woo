import "server-only";
import { priceWooCart, type CartAddress, type CartLine, type ShippingOption } from "@/lib/woo/store-cart";
import { checkCouponAccess, type CouponRole } from "@/lib/woo/coupons";

export type CheckoutQuote = {
  options:        ShippingOption[];
  selectedRateId: string | null;
  coupon:         { code: string; discount: number } | null;
  couponError:    string | null;
  lineErrors:     string[];
  subtotal:       number;
  discount:       number;
  itemTax:        number;
  lines:          Awaited<ReturnType<typeof priceWooCart>>["lines"];
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total for the cart with the given shipping option, the way Woo adds it up. */
export function quoteTotal(q: Pick<CheckoutQuote, "subtotal" | "discount" | "itemTax">, rate: ShippingOption | null): number {
  return round2(q.subtotal - q.discount + q.itemTax + (rate ? rate.cost + rate.tax : 0));
}

/**
 * Prices the checkout in WooCommerce. A coupon the role may not use, or that
 * Woo refuses, is left off and reported in couponError; the rest is still priced.
 */
export async function quoteCheckout(
  items:   CartLine[],
  address: CartAddress,
  role:    CouponRole,
  opts:    { couponCode?: string | null; shippingRateId?: string | null } = {},
): Promise<CheckoutQuote> {
  let couponCode = opts.couponCode?.trim() || null;
  let couponError: string | null = null;
  if (couponCode) {
    couponError = await checkCouponAccess(couponCode, role);
    if (couponError) couponCode = null;
  }

  const cart = await priceWooCart(items, address, { couponCode, shippingRateId: opts.shippingRateId });
  return {
    ...cart,
    couponError: couponError ?? cart.couponError,
    subtotal:    round2(cart.subtotal),
    discount:    round2(cart.discount),
    itemTax:     round2(cart.itemTax),
  };
}
