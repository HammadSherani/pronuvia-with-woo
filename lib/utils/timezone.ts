// Single source of truth for "what timezone does this app run on". Safe to
// import from both Server and Client Components — Intl.DateTimeFormat works
// identically in the browser and in Node, so nothing here needs a
// "server-only" guard. Reuses the existing PAYOUT_TIMEZONE env var (already
// set to "America/New_York" in Vercel and proven working for the payout
// cron) rather than introducing a second env var — the name just stops
// being payout-specific in practice now that the whole app uses it.
export const APP_TIMEZONE = process.env.PAYOUT_TIMEZONE || "America/New_York";

export type LocalDateParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
};

/** Breaks `date` down into its calendar-day/time components as seen in `timeZone`. */
export function getLocalDateParts(date: Date, timeZone: string = APP_TIMEZONE): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

/** The `timeZone` wall-clock offset from UTC, in ms, at `instant`. Negative west of UTC. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const tzWallClock = new Date(instant.toLocaleString("en-US", { timeZone }));
  const utcWallClock = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  return tzWallClock.getTime() - utcWallClock.getTime();
}

/** The absolute instant at which `timeZone`'s wall clock reads the given components. */
function zonedTimeToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number, ms: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offset = tzOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

/** Absolute instant of 00:00:00.000 on `date`'s calendar day in `timeZone`. */
export function startOfDay(date: Date, timeZone: string = APP_TIMEZONE): Date {
  const p = getLocalDateParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, 0, timeZone);
}

/** Absolute instant of 23:59:59.999 on `date`'s calendar day in `timeZone`. */
export function endOfDay(date: Date, timeZone: string = APP_TIMEZONE): Date {
  const p = getLocalDateParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, 23, 59, 59, 999, timeZone);
}

/** Absolute instant of the 1st of `date`'s calendar month, 00:00:00.000, in `timeZone`. */
export function startOfMonth(date: Date, timeZone: string = APP_TIMEZONE): Date {
  const p = getLocalDateParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, 1, 0, 0, 0, 0, timeZone);
}

/** Absolute instant of the last moment of `date`'s calendar month in `timeZone`. */
export function endOfMonth(date: Date, timeZone: string = APP_TIMEZONE): Date {
  const p = getLocalDateParts(date, timeZone);
  const nextMonthStart = zonedTimeToUtc(p.year, p.month + 1, 1, 0, 0, 0, 0, timeZone);
  return new Date(nextMonthStart.getTime() - 1);
}

/** Resolves an `<input type="date">` value ("2026-09-07") to that calendar day's
 * start-of-day instant in `timeZone`, instead of the default UTC-midnight parse. */
export function parseDateOnlyInTZ(dateStr: string, timeZone: string = APP_TIMEZONE): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 0, 0, 0, 0, timeZone);
}

/** Resolves an `<input type="date">` value to the END of that calendar day in `timeZone`. */
export function parseDateOnlyEndOfDayInTZ(dateStr: string, timeZone: string = APP_TIMEZONE): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 23, 59, 59, 999, timeZone);
}

/** The inverse of parseDateOnlyInTZ/parseDateOnlyEndOfDayInTZ — formats `date`
 * as the "YYYY-MM-DD" its calendar day in `timeZone`, for populating an
 * `<input type="date">` when editing a previously-stored value. Using
 * `date.toISOString().slice(0,10)` here would read the UTC calendar day
 * instead and can be off by one. */
export function toDateInputValue(date: Date | string, timeZone: string = APP_TIMEZONE): string {
  const p = getLocalDateParts(new Date(date), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// ── Display formatters — always anchored to APP_TIMEZONE ─────────────────

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function formatDateLong(date: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function formatDateTime(date: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  });
}

export function formatMonthYear(date: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "long",
    year: "numeric",
    ...opts,
  });
}
