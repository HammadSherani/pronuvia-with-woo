import { getLocalDateParts, startOfDay } from "@/lib/utils/timezone";

export type ShippingTier = {
  rate:          number;
  label:         string;
  estimatedDays: number;
};

export function calculateShipping(subtotal: number): ShippingTier {
  if (subtotal >= 150) return { rate: 0,    label: "Free Standard Shipping", estimatedDays: 7 };
  if (subtotal >= 75)  return { rate: 4.99, label: "Standard Shipping",      estimatedDays: 7 };
  return                      { rate: 9.99, label: "Standard Shipping",      estimatedDays: 7 };
}

/** Adds `days` business days (skipping Sat/Sun) to today, using the app's
 * timezone to decide what "today" and each weekday transition is — a plain
 * server-local Date.getDay() would compute the wrong weekday whenever the
 * server process isn't running in that timezone. */
export function estimatedDeliveryDate(days: number): Date {
  const p = getLocalDateParts(new Date());
  let cursor = Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0); // noon anchor, DST-agnostic day arithmetic
  let remaining = days;
  while (remaining > 0) {
    cursor += 86_400_000;
    const dow = new Date(cursor).getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return startOfDay(new Date(cursor));
}
