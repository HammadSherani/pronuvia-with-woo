"use client";

import { useEffect, useRef, useState } from "react";
import { getCheckoutQuote, type CheckoutQuoteView } from "@/actions/checkout/quote";
import type { ShippingOption } from "@/lib/woo/store-cart";

type QuoteItem = { productId: string; variationId?: number | null; quantity: number };
type QuoteAddress = { country: string; state: string; zip: string };

// Woo zones match on country, state and postcode only, so other address
// fields don't trigger a new quote. Typing a postcode is debounced.
const DEBOUNCE_MS = 400;
const LOAD_ERROR = "Shipping rates could not be loaded right now. Please try again.";

type Quote = { key: string; view: CheckoutQuoteView | null; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Shipping options, coupon and totals from WooCommerce for the checkout page.
 * The order is priced again on the server when it is placed; these numbers are
 * what the shopper sees, and the server checks it charges the same total.
 */
export function useCheckoutQuote(items: QuoteItem[], address: QuoteAddress) {
  const [attempt,     setAttempt]     = useState(0);
  const [couponCode,  setCouponCode]  = useState<string | null>(null);
  const [couponError, setCouponError] = useState("");
  // Results and the picked option are tagged with the request they belong to,
  // so a changed address, cart or coupon never shows the previous answer.
  const [quote,  setQuote]  = useState<Quote | null>(null);
  const [picked, setPicked] = useState<{ key: string; id: string } | null>(null);
  const answered = useRef<string | null>(null);

  const { country, state, zip } = address;
  const lines = items.map((i) => ({ productId: i.productId, variationId: i.variationId ?? null, quantity: i.quantity }));
  const key = JSON.stringify([country, state, zip, lines, couponCode, attempt]);

  useEffect(() => {
    if (!country || answered.current === key) return;
    const [, , , quoteItems, code, n] = JSON.parse(key) as [string, string, string, typeof lines, string | null, number];
    let stale = false;
    const timer = setTimeout(() => {
      getCheckoutQuote(quoteItems, { country, state: state || undefined, postcode: zip || undefined }, code)
        .then((res) => {
          if (stale) return;
          if (!res.ok) {
            setQuote({ key, view: null, error: res.message });
            return;
          }
          // A refused coupon is dropped; Woo priced the cart without it, so
          // this answer is also the one for "no coupon"
          let forKey = key;
          if (code && res.quote.couponError) {
            forKey = JSON.stringify([country, state, zip, quoteItems, null, n]);
            setCouponError(res.quote.couponError);
            setCouponCode(null);
          }
          answered.current = forKey;
          setQuote({ key: forKey, view: res.quote, error: "" });
        })
        .catch(() => {
          if (!stale) setQuote({ key, view: null, error: LOAD_ERROR });
        });
    }, DEBOUNCE_MS);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [key, country, state, zip]);

  const current  = country && quote?.key === key ? quote : null;
  const view     = current?.view ?? null;
  const options  = view?.options ?? [];
  const selected = options.find((o) => picked?.key === key && o.id === picked.id) ?? options[0] ?? null;

  const totals = view && selected ? {
    subtotal: view.subtotal,
    discount: view.discount,
    tax:      round2(view.itemTax + selected.tax),
    total:    round2(view.subtotal - view.discount + view.itemTax + selected.cost + selected.tax),
  } : null;

  return {
    options,
    selected,
    setSelected: (o: ShippingOption) => setPicked({ key, id: o.id }),
    loading:     !!country && !current,
    error:       current?.error ?? "",
    retry:       () => setAttempt((n) => n + 1),
    totals,
    coupon:        view?.coupon ?? null,
    couponError,
    couponPending: !!couponCode && !current,
    applyCoupon:   (code: string) => { setCouponError(""); setCouponCode(code.trim() || null); },
    removeCoupon:  () => { setCouponError(""); setCouponCode(null); },
  };
}

/** Builds the `checkout` payload the server prices the order from. */
export function checkoutSubmission(opts: {
  items:           { productId: string; variationId?: number | null; quantity: number; productTitle: string; variantSize: string }[];
  shippingAddress: string;
  billingAddress?: string;
  shippingRateId:  string;
  couponCode:      string | null;
  notes?:          string;
  customerEmail?:  string;
  customerPhone?:  string;
  expectedTotal:   number;
}) {
  return {
    ...opts,
    items: opts.items.map((i) => ({
      productId:   i.productId,
      variationId: i.variationId ?? null,
      quantity:    i.quantity,
      title:       i.productTitle,
      variantSize: i.variantSize,
    })),
  };
}

export type CheckoutPayload = ReturnType<typeof checkoutSubmission>;
