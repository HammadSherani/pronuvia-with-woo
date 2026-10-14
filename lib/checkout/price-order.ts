import "server-only";
import { z } from "zod";
import { WooError } from "@/lib/woo/client";
import type { CouponRole } from "@/lib/woo/coupons";
import { validateCartItemsAvailability } from "@/lib/orders/validate-items";
import { formatCurrency } from "@/lib/utils/currency";
import { quoteCheckout, quoteTotal, round2 } from "./quote";

// What the browser sends when an order is placed: what to buy, where to ship
// it, which shipping option and coupon, and the total it showed the shopper.
// No prices: those come from WooCommerce here.
export const CheckoutSubmissionSchema = z.object({
  items: z.array(z.object({
    productId:   z.string().regex(/^\d+$/),
    variationId: z.number().int().positive().nullable(),
    quantity:    z.number().int().positive().max(10_000),
    title:       z.string().max(300),
    variantSize: z.string().max(200),
  })).min(1).max(100),
  shippingAddress: z.string().min(2).max(5000),
  billingAddress:  z.string().max(5000).optional(),
  shippingRateId:  z.string().min(1).max(100),
  couponCode:      z.string().max(100).nullish(),
  notes:           z.string().max(5000).optional(),
  customerEmail:   z.string().max(320).optional(),
  customerPhone:   z.string().max(50).optional(),
  expectedTotal:   z.number().nonnegative(),
});

export type CheckoutSubmission = z.input<typeof CheckoutSubmissionSchema>;

export type OrderItem = {
  productId:   string;
  variationId: number | null;
  title:       string;
  variantSize: string;
  sku:         string;
  unitPrice:   number;
  quantity:    number;
  lineTotal:   number;
};

/** An order priced by WooCommerce. Every amount here is from the server. */
export type PricedOrder = {
  items:           OrderItem[];
  subtotal:        number;
  discountAmount:  number;
  couponCode:      string | undefined;
  shippingRate:    number;
  shippingMethod:  string;
  shippingRateId:  string;
  taxAmount:       number;
  total:           number;
  shippingAddress: string;
  billingAddress:  string | undefined;
  notes:           string | undefined;
  customerEmail:   string | undefined;
  customerPhone:   string | undefined;
};

export type PriceOrderResult =
  | { ok: true;  order: PricedOrder }
  // total_changed: Woo's total differs from what the shopper saw; `total` is the new one
  | { ok: false; message: string; code?: "total_changed" | "rate_changed"; total?: number };

const AddressSchema = z.object({
  country:  z.string().length(2),
  state:    z.string().optional(),
  zip:      z.string().optional(),
  city:     z.string().optional(),
  address1: z.string().optional(),
});

export async function priceOrder(raw: unknown, role: CouponRole): Promise<PriceOrderResult> {
  const parsed = CheckoutSubmissionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid checkout data. Please refresh the page and try again." };
  const input = parsed.data;

  let address: z.infer<typeof AddressSchema>;
  try {
    address = AddressSchema.parse(JSON.parse(input.shippingAddress));
  } catch {
    return { ok: false, message: "Please enter a complete shipping address." };
  }

  const availability = await validateCartItemsAvailability(input.items);
  if (!availability.valid) return { ok: false, message: availability.message };

  let quote: Awaited<ReturnType<typeof quoteCheckout>>;
  try {
    quote = await quoteCheckout(
      input.items,
      { country: address.country, state: address.state, postcode: address.zip, city: address.city, address1: address.address1 },
      role,
      { couponCode: input.couponCode, shippingRateId: input.shippingRateId },
    );
  } catch (e) {
    if (e instanceof WooError && (e.code === "woo_invalid_postcode" || e.code === "woo_shipping_no_items")) {
      return { ok: false, message: e.message };
    }
    console.error("[price-order]", e);
    return { ok: false, message: "The order total could not be calculated right now. Please try again." };
  }

  if (quote.lineErrors.length) return { ok: false, message: quote.lineErrors[0] };

  // Woo must hold every line at the requested quantity
  const wanted = new Map<number, number>();
  for (const i of input.items) {
    const id = i.variationId ?? Number(i.productId);
    wanted.set(id, (wanted.get(id) ?? 0) + i.quantity);
  }
  for (const [id, quantity] of wanted) {
    if (quote.lines.get(id)?.quantity !== quantity) {
      const item = input.items.find((i) => (i.variationId ?? Number(i.productId)) === id)!;
      return { ok: false, message: `"${item.title}" (${item.variantSize}) can't be ordered in this quantity right now.` };
    }
  }

  if (input.couponCode?.trim() && quote.couponError) {
    return { ok: false, message: `Coupon: ${quote.couponError}` };
  }

  const rate = quote.options.find((o) => o.id === quote.selectedRateId) ?? null;
  if (!rate || rate.id !== input.shippingRateId) {
    return { ok: false, code: "rate_changed", message: "The shipping option you picked is no longer available. Please choose it again." };
  }

  const total = quoteTotal(quote, rate);
  if (Math.abs(total - input.expectedTotal) > 0.005) {
    return {
      ok: false, code: "total_changed", total,
      message: `The order total is now ${formatCurrency(total)}. Please check it and place the order again.`,
    };
  }

  const items: OrderItem[] = input.items.map((i) => {
    const line = quote.lines.get(i.variationId ?? Number(i.productId))!;
    return {
      productId:   i.productId,
      variationId: i.variationId,
      title:       i.title,
      variantSize: i.variantSize,
      sku:         line.sku,
      unitPrice:   line.unitPrice,
      quantity:    i.quantity,
      lineTotal:   round2(line.unitPrice * i.quantity),
    };
  });

  return {
    ok: true,
    order: {
      items,
      subtotal:        quote.subtotal,
      discountAmount:  quote.discount,
      couponCode:      quote.coupon?.code.toUpperCase(),
      shippingRate:    rate.cost,
      shippingMethod:  rate.label,
      shippingRateId:  rate.id,
      taxAmount:       round2(quote.itemTax + rate.tax),
      total,
      shippingAddress: input.shippingAddress,
      billingAddress:  input.billingAddress || undefined,
      notes:           input.notes?.trim() || undefined,
      customerEmail:   input.customerEmail?.trim() || undefined,
      customerPhone:   input.customerPhone?.trim() || undefined,
    },
  };
}
