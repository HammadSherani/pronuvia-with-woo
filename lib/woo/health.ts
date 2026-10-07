import "server-only";
import { wooFetch, WooError } from "./client";

export const EXPECTED_CURRENCY = "USD";

export type WooHealth =
  | {
      ok:           true;
      latencyMs:    number;
      productCount: number;
      currency:     string;
      currencyOk:   boolean;
    }
  | {
      ok:        false;
      latencyMs: number;
      status:    number;
      code:      string;
      message:   string;
    };

export async function checkWooHealth(): Promise<WooHealth> {
  const started = Date.now();
  try {
    const [products, currency] = await Promise.all([
      wooFetch<unknown[]>("wc/v3/products", { query: { per_page: 1 } }),
      wooFetch<{ value: string }>("wc/v3/settings/general/woocommerce_currency"),
    ]);

    return {
      ok:           true,
      latencyMs:    Date.now() - started,
      productCount: Number(products.headers.get("x-wp-total") ?? 0),
      currency:     currency.data.value,
      currencyOk:   currency.data.value === EXPECTED_CURRENCY,
    };
  } catch (e) {
    const err = e instanceof WooError
      ? e
      : new WooError("Unexpected error while contacting WooCommerce.", 0, "woo_unknown");
    return {
      ok:        false,
      latencyMs: Date.now() - started,
      status:    err.status,
      code:      err.code,
      message:   err.message,
    };
  }
}
