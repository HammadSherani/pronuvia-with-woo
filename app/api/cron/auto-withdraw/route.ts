import { NextRequest, NextResponse } from "next/server";
import { getPayoutLocalDateParts, getPreviousMonthPayoutPeriod } from "@/lib/withdrawals/monthly";
import { runPayoutSweep } from "@/lib/withdrawals/run-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vercel's Hobby plan only allows a cron to fire once per day, and doesn't
  // guarantee the exact minute (or even hour) it lands in — so this can't
  // gate on an exact time-of-day the way it used to. Instead it gates only
  // on LOCAL DAY-OF-MONTH (in PAYOUT_TIMEZONE, a DST-observing zone like
  // America/New_York — Intl.DateTimeFormat resolves the correct EST/EDT
  // offset for any date automatically). vercel.json fires this once daily at
  // a fixed UTC time chosen to land comfortably after local midnight in both
  // DST regimes, so by the time it runs the local calendar has already
  // rolled over to the target day. Running more than once on that day is
  // harmless — sweepCommissionPeriod and the WithdrawRequest creation below
  // are both idempotent (commissionPaid flag / deterministic id), so a
  // second same-day invocation just finds nothing left to do.
  const now = new Date();
  const payoutTimeZone = process.env.PAYOUT_TIMEZONE ?? "UTC";
  const clock = getPayoutLocalDateParts(now, payoutTimeZone);
  // PAYOUT_TEST_DAY lets the monthly gate be pointed at a specific day-of-month
  // temporarily (e.g. "8") to confirm the cron actually fires unattended,
  // without touching the permanent rule below. Unset → always day 1.
  const testDay = Number(process.env.PAYOUT_TEST_DAY);
  const targetDay = Number.isInteger(testDay) && testDay >= 1 && testDay <= 31 ? testDay : 1;
  if (clock.day !== targetDay) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "Outside configured monthly payout day",
      timeZone: payoutTimeZone,
    });
  }
  const period = getPreviousMonthPayoutPeriod(now, payoutTimeZone);

  console.log(`[auto-withdraw] cron started – ${now.toISOString()}`);
  const result = await runPayoutSweep(period);
  return NextResponse.json(result);
}
