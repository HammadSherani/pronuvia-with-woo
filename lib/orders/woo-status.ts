import type { OrderStatus } from "@/generated/prisma/enums";

// Our order statuses in WooCommerce. Every order here is paid, so a new order
// (PENDING) is Woo "processing" (Woo's "pending" means unpaid). Woo has no
// "shipped" status without a plugin; like most stores we use "completed" for
// shipped/delivered. Our exact status rides along in meta `pronuvia_status`.

export const STATUS_META_KEY = "pronuvia_status";

const TO_WOO: Record<OrderStatus, string> = {
  PENDING:    "processing",
  PROCESSING: "processing",
  SHIPPED:    "completed",
  DELIVERED:  "completed",
  COMPLETED:  "completed",
  CANCELLED:  "cancelled",
  REFUNDED:   "refunded",
};

export function toWooStatus(status: OrderStatus): string {
  return TO_WOO[status];
}

/**
 * Our status for a Woo order. The meta wins while it agrees with Woo's status;
 * when someone changed the status in WP admin, Woo's status decides.
 */
export function fromWooStatus(wooStatus: string, metaStatus: unknown): OrderStatus {
  if (typeof metaStatus === "string" && metaStatus in TO_WOO && TO_WOO[metaStatus as OrderStatus] === wooStatus) {
    return metaStatus as OrderStatus;
  }
  switch (wooStatus) {
    case "completed": return "COMPLETED";
    case "cancelled":
    case "failed":    return "CANCELLED";
    case "refunded":  return "REFUNDED";
    default:          return "PROCESSING";   // pending, processing, on-hold
  }
}
