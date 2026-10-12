"use client";

import { useEffect, useState } from "react";
import { getShippingQuote } from "@/actions/checkout/shipping-quote";
import type { ShippingOption } from "@/lib/woo/shipping";

type QuoteItem = { productId: string; variationId?: number | null; quantity: number };
type QuoteAddress = { country: string; state: string; zip: string };

// Woo zones match on country, state and postcode only, so other address
// fields don't trigger a new quote. Typing a postcode is debounced.
const DEBOUNCE_MS = 400;
const LOAD_ERROR = "Shipping rates could not be loaded right now. Please try again.";

type Quote = { key: string; options: ShippingOption[]; error: string };

/** Shipping options from WooCommerce for the checkout's items and address. */
export function useShippingQuote(items: QuoteItem[], address: QuoteAddress) {
  const [attempt, setAttempt] = useState(0);
  // Results and the picked option are tagged with the request they belong to,
  // so a changed address or cart never shows the previous answer.
  const [quote,  setQuote]  = useState<Quote | null>(null);
  const [picked, setPicked] = useState<{ key: string; id: string } | null>(null);

  const { country, state, zip } = address;
  const lines = items.map((i) => ({ productId: i.productId, variationId: i.variationId ?? null, quantity: i.quantity }));
  const key = JSON.stringify([country, state, zip, lines, attempt]);

  useEffect(() => {
    if (!country) return;
    const [, , , quoteItems] = JSON.parse(key) as [string, string, string, typeof lines];
    let stale = false;
    const timer = setTimeout(() => {
      getShippingQuote(quoteItems, { country, state: state || undefined, postcode: zip || undefined })
        .then((res) => {
          if (!stale) setQuote(res.ok ? { key, options: res.options, error: "" } : { key, options: [], error: res.message });
        })
        .catch(() => {
          if (!stale) setQuote({ key, options: [], error: LOAD_ERROR });
        });
    }, DEBOUNCE_MS);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [key, country, state, zip]);

  const current  = country && quote?.key === key ? quote : null;
  const options  = current?.options ?? [];
  const selected = options.find((o) => picked?.key === key && o.id === picked.id) ?? options[0] ?? null;

  return {
    options,
    selected,
    setSelected: (o: ShippingOption) => setPicked({ key, id: o.id }),
    loading:     !!country && !current,
    error:       current?.error ?? "",
    retry:       () => setAttempt((n) => n + 1),
  };
}
