"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/dal";
import { Role } from "@/generated/prisma/enums";
import { quoteCheckout } from "@/lib/checkout/quote";
import { WooError } from "@/lib/woo/client";
import type { ShippingOption } from "@/lib/woo/store-cart";

export type CheckoutQuoteView = {
  options:     ShippingOption[];
  subtotal:    number;
  discount:    number;
  itemTax:     number;
  coupon:      { code: string; discount: number } | null;
  couponError: string | null;
};

export type CheckoutQuoteResult =
  | { ok: true;  quote: CheckoutQuoteView }
  | { ok: false; message: string };

const QuoteSchema = z.object({
  items: z.array(z.object({
    productId:   z.string().regex(/^\d+$/),
    variationId: z.number().int().positive().nullable(),
    quantity:    z.number().int().positive().max(10_000),
  })).min(1).max(100),
  address: z.object({
    country:  z.string().length(2),
    state:    z.string().max(50).optional(),
    postcode: z.string().max(20).optional(),
  }),
  couponCode: z.string().max(100).nullable(),
});

/**
 * Shipping options and totals from WooCommerce for the checkout page. Only for
 * showing: the order is priced again on the server when it is placed.
 */
export async function getCheckoutQuote(
  items:      z.input<typeof QuoteSchema>["items"],
  address:    z.input<typeof QuoteSchema>["address"],
  couponCode: string | null,
): Promise<CheckoutQuoteResult> {
  const session = await requireAuth();

  const parsed = QuoteSchema.safeParse({ items, address, couponCode });
  if (!parsed.success) return { ok: false, message: "Could not calculate shipping for this cart." };

  // Admins only order on behalf of a physician
  const role = session.role === Role.SALES_REP ? "SALES_REP" : "PHYSICIAN";

  try {
    const q = await quoteCheckout(parsed.data.items, parsed.data.address, role, { couponCode: parsed.data.couponCode });
    return {
      ok: true,
      quote: {
        options:     q.options,
        subtotal:    q.subtotal,
        discount:    q.discount,
        itemTax:     q.itemTax,
        coupon:      q.coupon && { code: q.coupon.code.toUpperCase(), discount: q.coupon.discount },
        couponError: q.couponError,
      },
    };
  } catch (e) {
    // Messages the shopper can act on are shown as they are
    if (e instanceof WooError && (e.code === "woo_invalid_postcode" || e.code === "woo_shipping_no_items")) {
      return { ok: false, message: e.message };
    }
    console.error("[checkout-quote]", e);
    return { ok: false, message: "Shipping rates could not be loaded right now. Please try again." };
  }
}
