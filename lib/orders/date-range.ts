import { endOfDay, endOfMonth, parseDateOnlyEndOfDayInTZ, parseDateOnlyInTZ, startOfDay, startOfMonth } from "@/lib/utils/timezone";

// The Orders pages' date filter (?range=today|month|last-month|custom&from&to),
// in the app's timezone. No range (or a bad one) = all orders.

export type OrdersRange = "all" | "today" | "month" | "last-month" | "custom";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseOrdersRange(sp: { range?: unknown; from?: unknown; to?: unknown }) {
  const range = (typeof sp.range === "string" ? sp.range : "all") as OrdersRange;
  const from  = typeof sp.from === "string" && DAY.test(sp.from) ? sp.from : "";
  const to    = typeof sp.to   === "string" && DAY.test(sp.to)   ? sp.to   : "";
  const now   = new Date();

  let createdAt: { gte?: Date; lte?: Date } | undefined;
  if (range === "today") createdAt = { gte: startOfDay(now), lte: endOfDay(now) };
  else if (range === "month") createdAt = { gte: startOfMonth(now), lte: endOfMonth(now) };
  else if (range === "last-month") {
    const prev = new Date(startOfMonth(now).getTime() - 1);
    createdAt = { gte: startOfMonth(prev), lte: endOfMonth(prev) };
  } else if (range === "custom" && (from || to)) {
    createdAt = {
      ...(from && { gte: parseDateOnlyInTZ(from) }),
      ...(to   && { lte: parseDateOnlyEndOfDayInTZ(to) }),
    };
  }

  return { range: createdAt ? range : "all" as OrdersRange, from, to, createdAt };
}
