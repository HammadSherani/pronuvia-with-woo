import "server-only";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { WooError } from "@/lib/woo/client";
import { getOrCreateWooCustomer } from "@/lib/woo/customers";
import { addOrderNote, createWooOrder, findWooOrder, updateWooOrder, type WooOrderAddress } from "@/lib/woo/orders";
import { STATUS_META_KEY, toWooStatus } from "./woo-status";

// Every paid order is saved in our database first (with the wallet debit, if
// any), then sent to WooCommerce here. A send that fails leaves the order
// PENDING_SYNC; /api/cron/woo-order-sync retries those, and the first failure
// emails the team. Nothing is ever charged without an order on our side.

export const SYNC = {
  PENDING: "PENDING_SYNC",
  SYNCING: "SYNCING",
  SYNCED:  "SYNCED",
} as const;

const ALERT_TO = "sales1.pronuvia@gmail.com";
// A send still marked SYNCING after this long died midway; it may be retried
const STALE_MS = 10 * 60 * 1000;

type OrderItem = { productId: string; variationId?: number | null; quantity: number; lineTotal: number };

function address(raw: string | null | undefined): WooOrderAddress | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw) as Record<string, string | undefined>;
    return {
      first_name: a.firstName ?? "", last_name: a.lastName ?? "",
      address_1:  a.address1  ?? "", address_2: a.address2 ?? "",
      city:       a.city      ?? "", state:     a.state    ?? "",
      postcode:   a.zip       ?? "", country:   a.country  ?? "",
      phone:      a.phone     ?? "",
    };
  } catch {
    return null;
  }
}

export type SyncResult =
  | { ok: true;  wooOrderId: number }
  | { ok: false; skipped: true }                 // already sent, or another send is running
  | { ok: false; skipped?: false; error: string };

/** Sends one of our orders to WooCommerce, at most once. */
export async function syncOrderToWoo(orderId: string): Promise<SyncResult> {
  // Claim the order so two senders never create it twice
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      OR: [
        { wooSyncStatus: SYNC.PENDING },
        { wooSyncStatus: SYNC.SYNCING, wooSyncAt: { lt: new Date(Date.now() - STALE_MS) } },
      ],
    },
    data: { wooSyncStatus: SYNC.SYNCING, wooSyncAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, skipped: true };

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  try {
    let woo = await findWooOrder(order.orderNumber, order.createdAt);
    let couponFallback = false;

    if (!woo) {
      // The customer is the physician for physician and on-behalf orders, else
      // the rep; one not linked yet is linked now (a guest order if that fails)
      const owner = order.physicianId
        ? { role: "PHYSICIAN" as const, id: order.physicianId }
        : order.salesRepId ? { role: "SALES_REP" as const, id: order.salesRepId } : null;
      const customerId = owner ? await getOrCreateWooCustomer(owner.role, owner.id).catch(() => null) : null;

      const shipping = address(order.shippingAddress);
      if (!shipping) throw new Error("Order has no readable shipping address.");
      const card = order.paymentMethod === "CARD";

      const send = (customer: number | null) => createWooOrder({
        orderNumber: order.orderNumber,
        customerId:  customer,
        billing:     address(order.billingAddress) ?? shipping,
        shipping,
        lines: (order.items as unknown as OrderItem[]).map((i) => ({
          productId: i.productId, variationId: i.variationId ?? null, quantity: i.quantity, lineTotal: i.lineTotal,
        })),
        shipping_line: { rateId: order.shippingRateId, title: order.shippingMethod ?? "Shipping", cost: order.shippingRate },
        couponCode:    order.couponCode,
        discount:      order.discountAmount,
        payment: {
          method:        card ? "pronuvia_stripe" : "pronuvia_wallet",
          title:         card ? "Credit card (Stripe)" : "Wallet",
          transactionId: order.transactionId ?? "",
        },
        note: order.notes,
        meta: {
          pronuvia_order_id:                    order.id,
          [STATUS_META_KEY]:                    order.status,
          pronuvia_tracking_number:             order.trackingNumber,
          pronuvia_shipping_carrier:            order.shippingCarrier,
          pronuvia_sales_rep_id:                order.salesRepId,
          pronuvia_physician_id:                order.physicianId,
          pronuvia_placed_by_admin:             order.placedByAdmin ? "yes" : undefined,
          pronuvia_placed_by_sales_rep:         order.placedBySalesRep ? "yes" : undefined,
          pronuvia_sales_rep_commission_rate:   order.salesRepCommissionRate,
          pronuvia_sales_rep_commission_amount: order.salesRepCommissionAmount,
          pronuvia_physician_commission_rate:   order.physicianCommissionRate,
          pronuvia_physician_commission_amount: order.physicianCommissionAmount,
          pronuvia_stripe_payment_intent:       order.stripePaymentIntentId,
          pronuvia_customer_email:              order.customerEmail,
          pronuvia_customer_phone:              order.customerPhone,
        },
      });

      let created: Awaited<ReturnType<typeof send>>;
      try {
        created = await send(customerId);
      } catch (e) {
        if (!owner || !customerId || !isInvalidCustomer(e)) throw e;
        // The linked Woo customer no longer exists (deleted in WP admin): link
        // the account again (or create its customer), else send it as a guest
        await unlinkWooCustomer(owner.role, owner.id);
        const relinked = await getOrCreateWooCustomer(owner.role, owner.id).catch(() => null);
        created = await send(relinked).catch((e2) => {
          if (relinked && isInvalidCustomer(e2)) return send(null);
          throw e2;
        });
      }
      woo = created.order;
      couponFallback = created.couponFallback;
    }

    // Changed here while it waited (e.g. cancelled): Woo created it as processing
    if (woo.status !== toWooStatus(order.status)) {
      woo = await updateWooOrder(woo.id, { status: toWooStatus(order.status) });
    }

    await prisma.order.update({
      where: { id: order.id },
      data:  { wooOrderId: woo.id, wooSyncStatus: SYNC.SYNCED, wooSyncError: null, wooSyncAt: new Date() },
    });

    // Woo works the total out again; it should match what was charged
    const wooTotal = Number(woo.total);
    if (Math.abs(wooTotal - order.total) > 0.005) {
      const msg = `Charged $${order.total.toFixed(2)}, but the WooCommerce order total is $${wooTotal.toFixed(2)}.`;
      await addOrderNote(woo.id, `Total mismatch: ${msg}`).catch(() => {});
      await alert(order.orderNumber, `Order ${order.orderNumber} total differs in WooCommerce`,
        `${msg} WooCommerce order #${woo.id}. Please check the order.`);
    } else if (couponFallback) {
      await alert(order.orderNumber, `Order ${order.orderNumber}: coupon not applied in WooCommerce`,
        `WooCommerce refused coupon ${order.couponCode} after payment; the order was created with the paid discount as a fee line. WooCommerce order #${woo.id}.`);
    }
    return { ok: true, wooOrderId: woo.id };
  } catch (e) {
    const error = e instanceof WooError || e instanceof Error ? e.message : String(e);
    console.error(`[woo-sync] order ${order.orderNumber}:`, e);
    const attempts = (order.wooSyncAttempts ?? 0) + 1;
    await prisma.order.update({
      where: { id: order.id },
      data:  { wooSyncStatus: SYNC.PENDING, wooSyncError: error.slice(0, 1000), wooSyncAttempts: attempts, wooSyncAt: new Date() },
    });
    if (attempts === 1) {
      await alert(order.orderNumber, `Order ${order.orderNumber} could not be sent to WooCommerce`,
        `The order is paid and saved in Pronuvia, but creating it in WooCommerce failed: ${error}. It will be retried automatically.`);
    }
    return { ok: false, error };
  }
}

/**
 * Sends a just-placed order, then retries any that are still waiting: on the
 * Hobby plan the cron only runs daily, so new orders keep the queue moving.
 */
export async function sendNewOrderToWoo(orderId: string): Promise<void> {
  await syncOrderToWoo(orderId);
  await retryPendingWooOrders(5);
}

const isInvalidCustomer = (e: unknown) =>
  e instanceof WooError && (e.code === "woocommerce_rest_invalid_customer_id" || /customer id is invalid/i.test(e.message));

async function unlinkWooCustomer(role: "PHYSICIAN" | "SALES_REP", id: string) {
  if (role === "PHYSICIAN") await prisma.partneringPhysician.update({ where: { id }, data: { wooCustomerId: null } });
  else await prisma.salesRepresentative.update({ where: { id }, data: { wooCustomerId: null } });
}

/** Retries orders that could not be sent yet. */
export async function retryPendingWooOrders(limit = 20): Promise<{ tried: number; synced: number; failed: number }> {
  const pending = await prisma.order.findMany({
    where: {
      OR: [
        // Leave a fresh order to its own send for a minute
        { wooSyncStatus: SYNC.PENDING, createdAt: { lt: new Date(Date.now() - 60 * 1000) } },
        { wooSyncStatus: SYNC.SYNCING, wooSyncAt: { lt: new Date(Date.now() - STALE_MS) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take:    limit,
    select:  { id: true },
  });
  let synced = 0, failed = 0;
  for (const { id } of pending) {
    const r = await syncOrderToWoo(id);
    if (r.ok) synced++;
    else if (!r.skipped) failed++;
  }
  return { tried: pending.length, synced, failed };
}

async function alert(orderNumber: string, subject: string, text: string) {
  try {
    await sendMail({
      to: ALERT_TO, subject, type: "WooCommerce Sync Alert", relatedId: orderNumber,
      html: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    });
  } catch (e) {
    console.error("[woo-sync] alert email failed:", e);
  }
}
