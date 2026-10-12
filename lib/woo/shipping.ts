import "server-only";
import { wooFetch, WooError } from "./client";

// Shipping rates come from the WooCommerce shipping zones (managed in WP admin
// under WooCommerce → Settings → Shipping). Woo picks the first zone, in zone
// order, that matches the address, and offers that zone's enabled methods.
//
// To get exactly what Woo would charge we ask the Store API as a guest: put the
// items in a fresh cart, set the shipping address, and read the rates back.

export type ShippingQuoteItem = {
  productId:   string;          // Woo product id
  variationId: number | null;   // Woo variation id, null for a simple product
  quantity:    number;
};

export type ShippingQuoteAddress = {
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
};

type StoreRate = {
  rate_id:             string;
  name:                string;
  price:               string;  // minor units, e.g. "999"
  currency_minor_unit: number;
  method_id:           string;
};

type StoreCart = {
  items:          { id: number; quantity: number }[];
  shipping_rates: { shipping_rates: StoreRate[] }[];
};

type BatchResponse = { responses: { status: number; body: unknown }[] };

const DAY = 24 * 60 * 60;

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

export async function quoteShipping(
  items: ShippingQuoteItem[],
  address: ShippingQuoteAddress,
): Promise<ShippingOption[]> {
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

  const { data } = await wooFetch<BatchResponse>("wc/store/v1/batch", {
    method:    "POST",
    anonymous: true,
    headers:   { "Cart-Token": cartToken },
    body: {
      requests: [
        ...[...quantities].map(([id, quantity]) => ({
          method: "POST", path: "/wc/store/v1/cart/add-item", body: { id, quantity },
        })),
        {
          method: "POST",
          path:   "/wc/store/v1/cart/update-customer",
          body: {
            shipping_address: {
              country:   address.country,
              state,
              postcode:  address.postcode ?? "",
              city:      address.city     ?? "",
              address_1: address.address1 ?? "",
            },
          },
        },
      ],
    },
  });

  const last = data.responses.at(-1);
  if (!last || last.status >= 400) {
    const body = last?.body as { message?: string; data?: { details?: { shipping_address?: { code?: string } } } } | undefined;
    if (body?.data?.details?.shipping_address?.code === "invalid_postcode") {
      throw new WooError("Please enter a valid ZIP / postal code for this country.", 400, "woo_invalid_postcode");
    }
    const reason = body?.message;
    throw new WooError(`WooCommerce could not calculate shipping${reason ? `: ${reason}` : "."}`, last?.status ?? 0, "woo_shipping_quote_failed");
  }

  // An item Woo refused (out of stock, unpublished) is left out of the cart.
  // Checkout blocks those items anyway; quote the rest.
  const cart = last.body as StoreCart;
  if (cart.items.length === 0) {
    throw new WooError("None of these items can be shipped right now.", 0, "woo_shipping_no_items");
  }

  // Woo puts the whole cart in one package unless a plugin splits it
  return (cart.shipping_rates[0]?.shipping_rates ?? []).map((r) => ({
    id:     r.rate_id,
    method: r.method_id,
    label:  r.name,
    cost:   Number(r.price) / 10 ** r.currency_minor_unit,
  }));
}
