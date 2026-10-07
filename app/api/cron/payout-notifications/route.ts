import { NextRequest, NextResponse } from "next/server";
import { processPendingPayoutNotifications } from "@/lib/withdrawals/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingPayoutNotifications();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[payout-notifications] cron failed:", error);
    return NextResponse.json({ error: "Notification retry failed" }, { status: 500 });
  }
}
