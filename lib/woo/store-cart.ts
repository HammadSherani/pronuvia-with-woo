import "server-only";
import { wooFetch, WooError } from "./client";

// Cart totals come from WooCommerce itself: the items go into a fresh guest
// cart on the Store API with the shipping address, coupon and chosen shipping
// rate, and Woo works out prices, discount, shipping (from the shipping zones
// in WP admin → WooCommerce → Settings → Shipping), tax and the total.

export type CartLine = {
  productId:   string;          // Woo product id
  variationId: number | null;   // Woo variation id, null for a simple product
  quantity:    number;
};

export type CartAddress = {
  country:   string;            // ISO 2-letter code
  state?:    string;
  postcode?: string;
  city?:     string;
  address1?: string;
};

export type ShippingOption = {
  id:     string;               // Woo rate id, e.g. "flat_rate:9"
  method: string;               // Woo method id: flat_rate, free_shipping, local_pickup…
  label:  string;               // method title as set in WP admin
  cost:   number;               // dollars, excluding tax
  tax:    number;               // tax on this rate, dollars
};

export type WooCart = {
  // Per Woo item id (variation id, or product id for a simple product)
  lines:          Map<number, { quantity: number; unitPrice: number; sku: string }>;
  // Lines Woo refused to add (out of stock, unpublished…), with Woo's reason
  lineErrors:     string[];
  options:        ShippingOption[];
  selectedRateId: string | null;
  coupon:         { code: string; discount: number } | null;
  couponError:    string | null;
  subtotal:       number;       // items before discount, excluding tax
  discount:       number;
  itemTax:        number;       // tax on items (shipping tax is on each option)
};

type StoreItem = {
  id:       number;
  quantity: number;
  sku:      string;
  prices:   { price: string; currency_minor_unit: number };
};

type StoreRate = {
  rate_id:             string;
  name:                string;
  price:               string;  // minor units, e.g. "999"
  taxes:               string;
  currency_minor_unit: number;
  method_id:           string;
  selected:            boolean;
};

type StoreCart = {
  items:          StoreItem[];
  coupons:        { code: string; totals: { total_discount: string; currency_minor_unit: number } }[];
  shipping_rates: { shipping_rates: StoreRate[] }[];
  totals: {
    total_items:         string;
    total_discount:      string;
    total_tax:           string;
    total_shipping_tax:  string | null;
    currency_minor_unit: number;
  };
};

type StoreError = { code?: string; message?: string; data?: { details?: { shipping_address?: { code?: string } } } };

type BatchResponse = { responses: { status: number; body: unknown }[] };

const DAY = 24 * 60 * 60;
// The Store API runs at most 25 requests per batch
const BATCH_LIMIT = 25;

const money = (minor: string | null | undefined, unit: number) => Number(minor ?? 0) / 10 ** unit;

// Woo messages carry HTML entities ("&#036;100.00") and sometimes tags
function plain(message: string | undefined): string {
  return (message ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

// Our address form uses country-state-city codes. Woo agrees for the US and
// Canada ("NY", "ON") but prefixes some countries ("BE" → "DE-BE") and has no
// states at all for others. Woo rejects the whole address on an unknown state,
// so map to Woo's code, or drop the state: country-wide zones still match.
async function wooStateCode(country: string, state?: string): Promise<string> {
  if (!state) return "";
  const { data } = await wooFetch<{ states: { code: string }[] }>(`wc/v3/data/countries/${country.toLowerCase()}`, {
    cacheFor: { revalidate: DAY, tags: ["woo-countries"] },
  });
  const codes = new Set(data.states.map((s) => s.code));
  if (codes.has(state)) return state;
  if (codes.has(`${country}-${state}`)) return `${country}-${state}`;
  return "";
}

export async function priceWooCart(
  items:   CartLine[],
  address: CartAddress,
  opts:    { couponCode?: string | null; shippingRateId?: string | null } = {},
): Promise<WooCart> {
  // Same product/variation twice → one cart line
  const quantities = new Map<number, number>();
  for (const i of items) {
    const id = i.variationId ?? Number(i.productId);
    quantities.set(id, (quantities.get(id) ?? 0) + i.quantity);
  }

  // A new guest cart; its Cart-Token authorises the writes below
  const [{ headers }, state] = await Promise.all([
    wooFetch<StoreCart>("wc/store/v1/cart", { anonymous: true }),
    wooStateCode(address.country, address.state),
  ]);
  const cartToken = headers.get("Cart-Token");
  if (!cartToken) throw new WooError("WooCommerce did not start a cart.", 0, "woo_no_cart_token");

  const batch = async (requests: { path: string; body: unknown }[]) => {
    const { data } = await wooFetch<BatchResponse>("wc/store/v1/batch", {
      method:    "POST",
      anonymous: true,
      headers:   { "Cart-Token": cartToken },
      body:      { requests: requests.map((r) => ({ method: "POST", ...r })) },
    });
    return data.responses;
  };

  const lineErrors: string[] = [];
  const adds = [...quantities].map(([id, quantity]) => ({ path: "/wc/store/v1/cart/add-item", body: { id, quantity } }));
  for (let i = 0; i < adds.length; i += BATCH_LIMIT) {
    for (const r of await batch(adds.slice(i, i + BATCH_LIMIT))) {
      if (r.status >= 400) lineErrors.push(plain((r.body as StoreError).message) || "An item could not be added.");
    }
  }

  // Address first (it decides the zone), then the coupon (a free-shipping
  // coupon adds a rate), then the rate the shopper picked.
  const code = opts.couponCode?.trim().toLowerCase();
  const steps = [
    { path: "/wc/store/v1/cart/update-customer", body: { shipping_address: {
      country:   address.country,
      state,
      postcode:  address.postcode ?? "",
      city:      address.city     ?? "",
      address_1: address.address1 ?? "",
    } } },
    ...(code ? [{ path: "/wc/store/v1/cart/apply-coupon", body: { code } }] : []),
    ...(opts.shippingRateId ? [{ path: "/wc/store/v1/cart/select-shipping-rate", body: { package_id: 0, rate_id: opts.shippingRateId } }] : []),
  ];
  const responses = await batch(steps);

  const customer = responses[0];
  if (!customer || customer.status >= 400) {
    const body = customer?.body as StoreError | undefined;
    if (body?.data?.details?.shipping_address?.code === "invalid_postcode") {
      throw new WooError("Please enter a valid ZIP / postal code for this country.", 400, "woo_invalid_postcode");
    }
    const reason = plain(body?.message);
    throw new WooError(`WooCommerce could not calculate shipping${reason ? `: ${reason}` : "."}`, customer?.status ?? 0, "woo_shipping_quote_failed");
  }

  const couponRes = code ? responses[1] : undefined;
  const couponError = couponRes && couponRes.status >= 400
    ? plain((couponRes.body as StoreError).message) || "This coupon cannot be used."
    : null;

  // Every step answers with the whole cart; the last good one is the final state
  const cart = [...responses].reverse().find((r) => r.status < 400)!.body as StoreCart;
  if (cart.items.length === 0) {
    throw new WooError("None of these items can be shipped right now.", 0, "woo_shipping_no_items");
  }

  const unit = cart.totals.currency_minor_unit;
  // Woo puts the whole cart in one package unless a plugin splits it
  const rates = cart.shipping_rates[0]?.shipping_rates ?? [];
  const applied = cart.coupons.find((c) => c.code === code);

  return {
    lines: new Map(cart.items.map((i) => [i.id, {
      quantity:  i.quantity,
      unitPrice: money(i.prices.price, i.prices.currency_minor_unit),
      sku:       i.sku,
    }])),
    lineErrors,
    options: rates.map((r) => ({
      id:     r.rate_id,
      method: r.method_id,
      label:  r.name,
      cost:   money(r.price, r.currency_minor_unit),
      tax:    money(r.taxes, r.currency_minor_unit),
    })),
    selectedRateId: rates.find((r) => r.selected)?.rate_id ?? null,
    coupon:         applied ? { code: applied.code, discount: money(applied.totals.total_discount, applied.totals.currency_minor_unit) } : null,
    couponError,
    subtotal: money(cart.totals.total_items, unit),
    discount: money(cart.totals.total_discount, unit),
    itemTax:  money(cart.totals.total_tax, unit) - money(cart.totals.total_shipping_tax, unit),
  };
}
