import { NextRequest, NextResponse } from "next/server";
import { periodFromKey } from "@/lib/withdrawals/monthly";
import { runPayoutSweep } from "@/lib/withdrawals/run-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-off manual sweep of an explicit "YYYY-MM" period, independent of the
 * recurring auto-withdraw cron's "previous month" gate — for closing a
 * still-open month early (e.g. a specific requested date) without disturbing
 * the regular monthly schedule. Target period comes from the `period` query
 * param, e.g. `/api/cron/manual-sweep?period=2026-09`.
 *
 * TEMPORARY: this route (and its vercel.json entry) exists for a specific
 * one-time request and should be removed once no longer needed.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodKey = req.nextUrl.searchParams.get("period");
  if (!periodKey) {
    return NextResponse.json({ error: "Missing required ?period=YYYY-MM query param." }, { status: 400 });
  }

  let period;
  try {
    period = periodFromKey(periodKey);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid period." }, { status: 400 });
  }

  console.log(`[manual-sweep] started for period ${period.key} – ${new Date().toISOString()}`);
  const result = await runPayoutSweep(period);
  return NextResponse.json(result);
}
