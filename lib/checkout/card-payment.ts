import "server-only";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/server";
import type { CouponRole } from "@/lib/woo/coupons";
import { priceOrder, type PricedOrder } from "./price-order";

// Card checkout in two steps:
// 1. startCardPayment: price the order in Woo, save that quote, and create a
//    Stripe PaymentIntent for exactly its total.
// 2. takeCardQuote: once Stripe says the payment succeeded, load the quote
//    the PaymentIntent was made from. The order is built from it.

const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;

const toCents = (n: number) => Math.round(n * 100);

/** Handles a payment-intent request; responds with { clientSecret, total } or { error, code?, total? }. */
export async function startCardPayment(opts: {
  body:         unknown;
  role:         CouponRole;
  userId:       string;
  physicianId?: string;
  metadata:     Record<string, string>;
}): Promise<NextResponse> {
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });

  const checkout = (opts.body as { checkout?: unknown } | null)?.checkout;
  const priced = await priceOrder(checkout, opts.role);
  if (!priced.ok) {
    return NextResponse.json({ error: priced.message, code: priced.code, total: priced.total }, { status: 400 });
  }
  if (toCents(priced.order.total) < 50) {
    return NextResponse.json({ error: "Card payments need an order total of at least $0.50." }, { status: 400 });
  }

  // Old quotes whose payment was never finished
  await prisma.checkoutQuote.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - QUOTE_TTL_MS) } } });
  const quote = await prisma.checkoutQuote.create({
    data: {
      userId:      opts.userId,
      physicianId: opts.physicianId,
      order:       priced.order,
      total:       priced.order.total,
    },
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount:   toCents(priced.order.total),
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { ...opts.metadata, quoteId: quote.id },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, total: priced.order.total });
}

/** The priced order a succeeded PaymentIntent paid for, if it belongs to this user. */
export async function takeCardQuote(
  pi:     Stripe.PaymentIntent,
  userId: string,
): Promise<{ ok: true; order: PricedOrder; quoteId: string } | { ok: false; message: string }> {
  const quoteId = pi.metadata.quoteId;
  const quote = quoteId ? await prisma.checkoutQuote.findUnique({ where: { id: quoteId } }) : null;
  if (!quote || quote.userId !== userId) {
    return { ok: false, message: "This payment's order details could not be found. Please contact support." };
  }
  if (toCents(quote.total) !== pi.amount) {
    return { ok: false, message: "Payment amount mismatch. Please contact support." };
  }
  return { ok: true, order: quote.order as unknown as PricedOrder, quoteId: quote.id };
}
