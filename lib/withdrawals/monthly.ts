import { createHash } from "node:crypto";
import { getLocalDateParts } from "@/lib/utils/timezone";

export type PayoutRole = "SALES_REP" | "PHYSICIAN";
export type PayoutStatus = "PENDING" | "APPROVED" | "REJECTED";

export type MonthlyPayoutPeriod = {
  key: string;
  label: string;
  note: string;
  start: Date;
  end: Date;
  snapshotAt: Date;
};

/** @deprecated thin wrapper kept for existing callers — use getLocalDateParts from lib/utils/timezone directly in new code. */
export function getPayoutLocalDateParts(now: Date, timeZone = "UTC") {
  return getLocalDateParts(now, timeZone);
}

export function getPreviousMonthPayoutPeriod(now = new Date(), timeZone = "UTC"): MonthlyPayoutPeriod {
  const local = getPayoutLocalDateParts(now, timeZone);
  const start = new Date(Date.UTC(local.year, local.month - 2, 1));
  const end = new Date(Date.UTC(local.year, local.month - 1, 1));
  const label = start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  return { key, label, note: `Auto withdrawal - ${label}`, start, end, snapshotAt: now };
}

/**
 * The still-open commission period "now" falls in. Orders placed in this
 * window are Pending Commission until this period closes (see
 * getPreviousMonthPayoutPeriod, evaluated from next month) and are swept
 * into the wallet. Also used to tag which period a reversal (refund/
 * cancellation) lands in, for net-period accounting.
 */
export function getCurrentPeriod(now = new Date(), timeZone = "UTC"): MonthlyPayoutPeriod {
  const local = getPayoutLocalDateParts(now, timeZone);
  const start = new Date(Date.UTC(local.year, local.month - 1, 1));
  const end = new Date(Date.UTC(local.year, local.month, 1));
  const label = start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  return { key, label, note: `Commission - ${label}`, start, end, snapshotAt: now };
}

export function isMonthlyAutoPayoutNote(note: string | null | undefined): boolean {
  return /^Auto withdrawal\s*(?:-|\u2013|\u2014)\s*.+$/i.test(note ?? "");
}

/**
 * Builds a payout period directly from an explicit "YYYY-MM" key, rather than
 * computing "the month before now" \u2014 used by one-off manual sweeps (e.g. an
 * early/out-of-cycle close of a still-open month) where the target period
 * isn't necessarily the previous calendar month.
 */
export function periodFromKey(key: string): MonthlyPayoutPeriod {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Invalid period key "${key}" \u2014 expected "YYYY-MM".`);
  const year  = Number(match[1]);
  const month = Number(match[2]); // 1-12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return { key, label, note: `Auto withdrawal - ${label}`, start, end, snapshotAt: new Date() };
}

/**
 * Gives automatically-created monthly requests a deterministic Mongo ObjectId.
 * This prevents two concurrent cron invocations from creating two requests for
 * the same user and payout period.
 */
export function monthlyPayoutRequestId(userId: string, userRole: PayoutRole, periodKey: string): string {
  return createHash("sha256")
    .update(`${userRole}:${userId}:${periodKey}`)
    .digest("hex")
    .slice(0, 24);
}

export function parsePayoutPeriod(note: string | null | undefined, fallbackDate: Date): string {
  const match = note?.match(/^Auto withdrawal\s*(?:-|\u2013|\u2014)\s*(.+)$/i);
  return match?.[1]?.trim() || fallbackDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type MonthlyPayoutUser = {
  id: string;
  userRole: PayoutRole;
  walletBalance: number;
  hasBankAccount: boolean;
};

export type MonthlyPayoutRequest = {
  id: string;
  userId: string;
  userRole: PayoutRole;
  amount: number;
  status: PayoutStatus;
  note: string | null;
  createdAt: Date | string;
  periodKey?: string | null;
  snapshotAt?: Date | string | null;
};

export type MonthlyPayoutPlan = {
  update: Array<{ id: string; amount: number; note: string; periodKey: string; snapshotAt: Date }>;
  remove: string[];
  create: Array<{ userId: string; userRole: PayoutRole; amount: number; note: string; periodKey: string; snapshotAt: Date }>;
  skipApproved: string[];
};

/**
 * Builds an idempotent monthly payout plan without touching the database.
 * The cron handler executes this plan after both user lists and existing
 * requests have been read, which also makes the scheduling behavior testable.
 */
export function buildMonthlyPayoutPlan({
  users,
  requests,
  period,
}: {
  users: MonthlyPayoutUser[];
  requests: MonthlyPayoutRequest[];
  period: MonthlyPayoutPeriod;
}): MonthlyPayoutPlan {
  const plan: MonthlyPayoutPlan = { update: [], remove: [], create: [], skipApproved: [] };

  for (const user of users) {
    // Still create the request even without bank details on file — it must
    // stay visible to the admin so nothing owed goes unnoticed. The actual
    // payout stays blocked (approval enforces bank details separately) so
    // nothing is ever paid to an account with nowhere to send it.
    if (user.walletBalance <= 0) continue;

    const mine = requests
      .filter((request) => request.userId === user.id && request.userRole === user.userRole)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const approvedThisPeriod = mine.find(
      (request) => request.status === "APPROVED"
        && (request.periodKey === period.key || request.note === period.note),
    );
    if (approvedThisPeriod) {
      plan.skipApproved.push(user.id);
      continue;
    }

    const pendingThisPeriod = mine.filter(
      (request) => request.status === "PENDING"
        && (request.periodKey === period.key || request.note === period.note),
    );
    const keep = pendingThisPeriod[0];
    if (keep) {
      // A monthly request is a period snapshot. Once created, later wallet
      // activity must not silently change the amount being reviewed.
      plan.remove.push(...pendingThisPeriod.slice(1).map((request) => request.id));
      continue;
    }

    plan.create.push({
      userId: user.id,
      userRole: user.userRole,
      amount: Number(user.walletBalance.toFixed(2)),
      note: period.note,
      periodKey: period.key,
      snapshotAt: period.snapshotAt,
    });
  }

  return plan;
}
