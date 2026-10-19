import { NextRequest, NextResponse } from "next/server";
import { retryPendingWooOrders } from "@/lib/orders/woo-sync";
import { refreshRecentWooOrders } from "@/lib/orders/order-woo";
import { retryStripeRefunds } from "@/lib/orders/refunds";
import { ensureOrderWebhooksActive } from "@/lib/woo/webhook-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sends paid orders that could not reach WooCommerce yet (PENDING_SYNC),
// switches the Woo order webhook back on if Woo turned it off, brings orders
// changed in Woo in the last 7 days up to date in case a webhook was missed,
// and tries again card refunds Stripe did not take
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await retryPendingWooOrders();
  const webhooksReactivated = await ensureOrderWebhooksActive().catch((e) => {
    console.error("[cron woo-order-sync] webhook check failed:", e);
    return [];
  });
  const refreshed = await refreshRecentWooOrders(7);
  const stripeRefunds = await retryStripeRefunds();
  return NextResponse.json({ ...sent, webhooksReactivated, refreshed, stripeRefunds });
}
