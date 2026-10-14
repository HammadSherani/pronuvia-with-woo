import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";
import { reconcileOrders } from "@/lib/orders/reconcile";

export const dynamic = "force-dynamic";

// GET /api/woo/reconcile?days=30 → our orders vs their WooCommerce orders
// (total, status, money refunded), orders not in Woo yet, and Woo webhooks.
export async function GET(req: NextRequest) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const report = await reconcileOrders(days);
  return NextResponse.json(report, { status: report.issues.length ? 207 : 200 });
}
