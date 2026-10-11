"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/dal";
import { quoteShipping, type ShippingOption } from "@/lib/woo/shipping";
import { WooError } from "@/lib/woo/client";

export type ShippingQuoteResult =
  | { ok: true;  options: ShippingOption[] }
  | { ok: false; message: string };

const QuoteSchema = z.object({
  items: z.array(z.object({
    productId:   z.string().regex(/^\d+$/),
    variationId: z.number().int().positive().nullable(),
    quantity:    z.number().int().positive().max(10_000),
  })).min(1).max(200),
  address: z.object({
    country:  z.string().length(2),
    state:    z.string().max(50).optional(),
    postcode: z.string().max(20).optional(),
    city:     z.string().max(100).optional(),
    address1: z.string().max(200).optional(),
  }),
});

/** Shipping options for these cart items going to this address, from WooCommerce. */
export async function getShippingQuote(
  items:   z.input<typeof QuoteSchema>["items"],
  address: z.input<typeof QuoteSchema>["address"],
): Promise<ShippingQuoteResult> {
  await requireAuth();

  const parsed = QuoteSchema.safeParse({ items, address });
  if (!parsed.success) return { ok: false, message: "Could not calculate shipping for this cart." };

  try {
    const options = await quoteShipping(parsed.data.items, parsed.data.address);
    return { ok: true, options };
  } catch (e) {
    // Messages the shopper can act on are shown as they are
    if (e instanceof WooError && (e.code === "woo_invalid_postcode" || e.code === "woo_shipping_no_items")) {
      return { ok: false, message: e.message };
    }
    console.error("[shipping-quote]", e);
    return { ok: false, message: "Shipping rates could not be loaded right now. Please try again." };
  }
}
