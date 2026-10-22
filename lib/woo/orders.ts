import "server-only";
import { wooFetch, WooError } from "./client";
import type { WooMeta } from "./types";

// Creating orders in WooCommerce. Payment is already taken (Stripe or wallet)
// when an order gets here, so the order is created paid: Woo moves it to
// "processing", reduces stock and counts the coupon use.

export type WooOrderAddress = {
  first_name: string; last_name: string; address_1: string; address_2: string;
  city: string; state: string; postcode: string; country: string; phone: string;
};

export type WooOrderLine = {
  productId:   string;
  variationId: number | null;
  quantity:    number;
  lineTotal:   number;          // before discount; Woo spreads the coupon over it
};

export type NewWooOrder = {
  orderNumber:     string;
  customerId:      number | null;
  billing:         WooOrderAddress & { email?: string };
  shipping:        WooOrderAddress;
  lines:           WooOrderLine[];
  shipping_line:   { rateId: string | null; title: string; cost: number };
  couponCode:      string | null;
  discount:        number;
  payment:         { method: "pronuvia_stripe" | "pronuvia_wallet"; title: string; transactionId: string };
  note:            string | null;
  meta:            Record<string, string | number | boolean | null | undefined>;
};

export type WooOrder = {
  id:        number;
  number:    string;
  status:    string;
  total:     string;
  meta_data: WooMeta[];
};

export const ORDER_NUMBER_KEY = "pronuvia_order_number";

const money = (n: number) => n.toFixed(2);

function body(o: NewWooOrder, withCoupon: boolean) {
  const [methodId, instanceId] = (o.shipping_line.rateId ?? "").split(":");
  const meta = Object.entries({ [ORDER_NUMBER_KEY]: o.orderNumber, ...o.meta })
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => ({ key, value: String(value) }));

  return {
    customer_id:          o.customerId ?? 0,
    created_via:          "pronuvia",
    set_paid:             true,
    payment_method:       o.payment.method,
    payment_method_title: o.payment.title,
    transaction_id:       o.payment.transactionId,
    // The billing email is the patient's (WP shows it as "Patient's Email
    // address"); without one Woo fills it from the customer account. The
    // patient's email is also in the order meta. Order emails are sent by
    // Next.js (Woo's customer emails are off).
    billing:              o.billing,
    shipping:             o.shipping,
    customer_note:        o.note ?? "",
    line_items: o.lines.map((l) => ({
      product_id: Number(l.productId),
      ...(l.variationId && { variation_id: l.variationId }),
      quantity:   l.quantity,
      // The price that was charged, even if the Woo price changed since
      subtotal:   money(l.lineTotal),
      total:      money(l.lineTotal),
    })),
    shipping_lines: [{
      method_id:    methodId || "flat_rate",
      ...(instanceId && { instance_id: instanceId }),
      method_title: o.shipping_line.title,
      total:        money(o.shipping_line.cost),
    }],
    ...(withCoupon && o.couponCode
      ? { coupon_lines: [{ code: o.couponCode.toLowerCase() }] }
      // The coupon was charged but Woo won't apply it now (e.g. it reached
      // its limit meanwhile): keep the paid total with a discount line
      : o.discount > 0 ? { fee_lines: [{ name: `Discount${o.couponCode ? ` (coupon ${o.couponCode})` : ""}`, total: money(-o.discount), tax_status: "none" }] } : {}),
    meta_data: meta,
  };
}

/** Creates the paid order in Woo. Falls back to a discount line if Woo refuses the coupon. */
export async function createWooOrder(o: NewWooOrder): Promise<{ order: WooOrder; couponFallback: boolean }> {
  try {
    const { data } = await wooFetch<WooOrder>("wc/v3/orders", { method: "POST", body: body(o, true) });
    return { order: data, couponFallback: false };
  } catch (e) {
    const couponProblem = e instanceof WooError && e.status === 400 && !!o.couponCode && /coupon/i.test(e.message);
    if (!couponProblem) throw e;
    const { data } = await wooFetch<WooOrder>("wc/v3/orders", { method: "POST", body: body(o, false) });
    await addOrderNote(data.id, `Coupon ${o.couponCode} could not be applied in WooCommerce (${e.message}); the discount the customer paid with is kept as a fee line.`);
    return { order: data, couponFallback: true };
  }
}

export const ORDER_ID_KEY = "pronuvia_order_id";

/**
 * An order we already sent, found by our order id. A send can succeed in Woo
 * even when its response never reaches us, so a retry looks first. Not by the
 * order number: a number can come back after the newest order is deleted.
 */
export async function findWooOrder(orderId: string, since: Date): Promise<WooOrder | null> {
  const after = new Date(since.getTime() - 60 * 60 * 1000).toISOString().slice(0, 19);
  for (let page = 1; page <= 5; page++) {
    const { data } = await wooFetch<WooOrder[]>(`wc/v3/orders?after=${after}&per_page=100&page=${page}&status=any`);
    const hit = data.find((w) => w.meta_data.some((m) => m.key === ORDER_ID_KEY && String(m.value) === orderId));
    if (hit) return hit;
    if (data.length < 100) break;
  }
  return null;
}

export async function addOrderNote(orderId: number, note: string): Promise<void> {
  await wooFetch(`wc/v3/orders/${orderId}/notes`, { method: "POST", body: { note, customer_note: false } });
}

// ── Reading and changing orders (Phase 7) ──

export type WooOrderDetail = WooOrder & {
  billing:  WooOrderAddress & { email?: string };
  shipping: WooOrderAddress;
  date_modified_gmt: string;
  line_items: { id: number; product_id: number; variation_id: number; quantity: number; total: string }[];
  refunds:    { id: number; reason: string; total: string }[];
};

export type WooOrderNote = {
  id:            number;
  author:        string;
  date_created_gmt: string;
  note:          string;
  customer_note: boolean;
  added_by_user: boolean;
};

export async function getWooOrder(id: number): Promise<WooOrderDetail> {
  return (await wooFetch<WooOrderDetail>(`wc/v3/orders/${id}`)).data;
}

export async function updateWooOrder(id: number, changes: Record<string, unknown>): Promise<WooOrderDetail> {
  return (await wooFetch<WooOrderDetail>(`wc/v3/orders/${id}`, { method: "PUT", body: changes })).data;
}

/** Many orders at once; returns the ids Woo updated. */
export async function updateWooOrders(updates: ({ id: number } & Record<string, unknown>)[]): Promise<Set<number>> {
  const done = new Set<number>();
  for (let i = 0; i < updates.length; i += 100) {
    const { data } = await wooFetch<{ update?: { id: number; error?: unknown }[] }>("wc/v3/orders/batch", {
      method: "POST",
      body:   { update: updates.slice(i, i + 100) },
    });
    for (const u of data.update ?? []) if (u.id && !u.error) done.add(u.id);
  }
  return done;
}

export async function getWooOrderNotes(orderId: number): Promise<WooOrderNote[]> {
  return (await wooFetch<WooOrderNote[]>(`wc/v3/orders/${orderId}/notes`)).data;
}

export async function addWooOrderNote(orderId: number, note: string, customerNote: boolean): Promise<WooOrderNote> {
  return (await wooFetch<WooOrderNote>(`wc/v3/orders/${orderId}/notes`, {
    method: "POST",
    body:   { note, customer_note: customerNote },
  })).data;
}

// ── Refunds (Phase 9) ──

export type WooRefund = {
  id:         number;
  amount:     string;
  reason:     string;
  line_items: { product_id: number; variation_id: number; quantity: number; total: string }[];
  meta_data:  WooMeta[];
};

export const REFUND_ID_KEY = "pronuvia_refund_id";

export async function getWooRefund(orderId: number, refundId: number): Promise<WooRefund> {
  return (await wooFetch<WooRefund>(`wc/v3/orders/${orderId}/refunds/${refundId}`)).data;
}
