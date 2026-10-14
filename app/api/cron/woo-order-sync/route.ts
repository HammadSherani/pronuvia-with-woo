import { NextRequest, NextResponse } from "next/server";
import { retryPendingWooOrders } from "@/lib/orders/woo-sync";
import { refreshRecentWooOrders } from "@/lib/orders/order-woo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sends paid orders that could not reach WooCommerce yet (PENDING_SYNC), and
// brings orders changed in Woo lately up to date in case a webhook was missed
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await retryPendingWooOrders();
  const refreshed = await refreshRecentWooOrders();
  return NextResponse.json({ ...sent, refreshed });
}
