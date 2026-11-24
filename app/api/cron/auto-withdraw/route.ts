import { NextRequest, NextResponse } from "next/server";
import { refreshAllPayoutRequests } from "@/lib/commission/lines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily (vercel.json). Commission goes into Commission Payout as soon as the
 * admin approves it on the WP order page, one payout request per user and
 * commission month (lib/commission/lines), so there is no month-end run any
 * more. This only re-checks every user's payout requests against their
 * commission lines, as a safety net.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await refreshAllPayoutRequests();
  console.log(`[auto-withdraw] payout requests checked for ${result.users} users`);
  return NextResponse.json({ success: true, ...result });
}
