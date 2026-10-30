import { endOfDay, endOfMonth, getLocalDateParts, parseDateOnlyEndOfDayInTZ, parseDateOnlyInTZ, startOfDay, startOfMonth } from "@/lib/utils/timezone";

// The date filter of the Orders pages and the rep's commission-by-physician
// table (?range=today|week|month|last-month|6-months|custom&from&to),
// in the app's timezone. No range (or a bad one) = all orders.

export type OrdersRange = "all" | "today" | "week" | "month" | "last-month" | "6-months" | "custom";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Start of the calendar day `days` days / `months` months before today (app timezone). */
function daysAgo(now: Date, days: number, months = 0): Date {
  const p = getLocalDateParts(now);
  const d = new Date(Date.UTC(p.year, p.month - 1 - months, p.day - days));
  return parseDateOnlyInTZ(d.toISOString().slice(0, 10));
}

export function parseOrdersRange(sp: { range?: unknown; from?: unknown; to?: unknown }) {
  const range = (typeof sp.range === "string" ? sp.range : "all") as OrdersRange;
  const from  = typeof sp.from === "string" && DAY.test(sp.from) ? sp.from : "";
  const to    = typeof sp.to   === "string" && DAY.test(sp.to)   ? sp.to   : "";
  const now   = new Date();

  let createdAt: { gte?: Date; lte?: Date } | undefined;
  if (range === "today") createdAt = { gte: startOfDay(now), lte: endOfDay(now) };
  else if (range === "week") {
    // Monday to now
    const p = getLocalDateParts(now);
    const sinceMonday = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
    createdAt = { gte: daysAgo(now, sinceMonday), lte: endOfDay(now) };
  }
  else if (range === "6-months") createdAt = { gte: daysAgo(now, 0, 6), lte: endOfDay(now) };
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
