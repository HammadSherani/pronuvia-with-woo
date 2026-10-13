import "server-only";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { sendTrackingEmail } from "./tracking-email";

// Shipping labels are bought in WP admin with the WooCommerce Shipping plugin,
// which keeps them in the order meta `wcshipping_labels`. When an order is
// brought up to date (webhook, cron, or opening it) its labels land here:
// the first outbound label marks the order shipped, the newest one is the
// tracking shown in the lists, and each one emails its tracking once.
// Return labels never change the order status.

export const LABELS_META_KEY = "wcshipping_labels";

const CARRIERS: Record<string, string> = { usps: "USPS", ups: "UPS", upsdap: "UPS", fedex: "FedEx", dhlexpress: "DHL Express" };

export const carrierName = (id: string) => CARRIERS[id.toLowerCase()] ?? id.toUpperCase();

type PluginLabel = {
  label_id?:     number;
  tracking?:     string | null;
  carrier_id?:   string;
  service_name?: string;
  status?:       string;
  is_return?:    boolean;
  created?:      number;
  refund?:       unknown;
  package_name?: string;
};

export type WooLabelData = {
  labelId:     number;
  tracking:    string;
  carrier:     string;
  service:     string;
  packageName: string | null;
  isReturn:    boolean;
  refunded:    boolean;
  purchasedAt: Date;
};

/** Labels from the meta; ones still being bought (no tracking yet) are left out. */
export function parseWooLabels(meta: unknown): WooLabelData[] {
  if (!Array.isArray(meta)) return [];
  return (meta as PluginLabel[])
    .filter((l) => typeof l.label_id === "number" && !!l.tracking)
    .map((l) => ({
      labelId:     l.label_id!,
      tracking:    String(l.tracking),
      carrier:     l.carrier_id ?? "",
      service:     l.service_name ?? "",
      packageName: l.package_name ?? null,
      isReturn:    !!l.is_return,
      // The plugin adds a `refund` entry when a label's refund is requested
      refunded:    !!l.refund,
      // The plugin stores milliseconds
      purchasedAt: new Date(l.created && l.created < 1e12 ? l.created * 1000 : l.created ?? Date.now()),
    }));
}

/**
 * Applies the labels of an order's Woo order. `setShipped` marks the order
 * shipped in Woo and here; it is passed in so this file needs no Woo client.
 */
export async function applyWooLabels(
  orderId: string,
  labels: WooLabelData[],
  setShipped: (tracking: WooLabelData) => Promise<void>,
): Promise<void> {
  if (!labels.length) return;

  for (const l of labels) {
    await prisma.wooLabel.upsert({
      where:  { orderId_labelId: { orderId, labelId: l.labelId } },
      create: { orderId, ...l, notifiedAt: null },
      update: { refunded: l.refunded, tracking: l.tracking, service: l.service, packageName: l.packageName },
    });
  }

  const order = await prisma.order.findUniqueOrThrow({
    where:  { id: orderId },
    select: { status: true, trackingNumber: true, shippingCarrier: true },
  });
  const ours = await prisma.wooLabel.findMany({ where: { orderId }, orderBy: { purchasedAt: "desc" } });
  const active = ours.filter((l) => !l.isReturn && !l.refunded);
  const newest = active[0] ?? null;

  // The tracking the lists show: the newest active outbound label. A refunded
  // label's tracking is replaced (or cleared); tracking from the old custom
  // label code or typed in by hand is left alone.
  const fromWoo = ours.some((l) => l.tracking === order.trackingNumber);
  if (newest && (newest.tracking !== order.trackingNumber || !order.trackingNumber)) {
    await prisma.order.update({
      where: { id: orderId },
      data:  { trackingNumber: newest.tracking, shippingCarrier: `${carrierName(newest.carrier)} - ${newest.service}` },
    });
  } else if (!newest && fromWoo) {
    await prisma.order.update({ where: { id: orderId }, data: { trackingNumber: null, shippingCarrier: null } });
  }

  if (newest && (order.status === OrderStatus.PENDING || order.status === OrderStatus.PROCESSING)) {
    await setShipped(newest);
  }

  // Each outbound label's tracking is emailed once; claiming it first means
  // a webhook and a page view arriving together still send one email. (On
  // MongoDB `null` does not match a missing field, hence both.)
  for (const l of active.filter((x) => !x.notifiedAt)) {
    const claimed = await prisma.wooLabel.updateMany({
      where: { id: l.id, OR: [{ notifiedAt: null }, { notifiedAt: { isSet: false } }] },
      data:  { notifiedAt: new Date() },
    });
    if (claimed.count !== 1) continue;
    try {
      await sendTrackingEmail(orderId, { number: l.tracking, carrier: `${carrierName(l.carrier)} - ${l.service}` });
    } catch (e) {
      console.error(`[woo-labels] tracking email for ${l.tracking} failed:`, e);
    }
  }
}
