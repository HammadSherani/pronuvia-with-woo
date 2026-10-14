import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/woo/catalog";
import { prisma } from "@/lib/db/prisma";
import { refreshOrderFromWoo } from "@/lib/orders/order-woo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WooCommerce webhooks (WP admin → WooCommerce → Settings → Advanced →
// Webhooks; secret = WOO_WEBHOOK_SECRET; topics: Order updated, Product
// updated / created / deleted). An order changed in Woo (status, address, a
// shipping label, a refund) is brought up to date here; a product change
// makes the shops reload the catalog.
//
// Each delivery reloads the current order from Woo rather than trusting the
// payload, so repeated or out-of-order deliveries all end in the same state.
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Woo pings a new webhook with "webhook_id=…" (unsigned); nothing to do
  if (/^webhook_id=\d+$/.test(raw.trim())) return NextResponse.json({ ok: true });

  const secret = process.env.WOO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhooks are not configured." }, { status: 503 });

  const given    = Buffer.from(req.headers.get("x-wc-webhook-signature") ?? "");
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("base64"));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const topic = req.headers.get("x-wc-webhook-topic") ?? "";
  let id: unknown;
  try {
    id = (JSON.parse(raw) as { id?: unknown }).id;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (topic.startsWith("product.")) revalidateTag(CATALOG_TAG, "max");

  if (topic.startsWith("order.") && typeof id === "number") {
    // Answer Woo right away; it gives up on slow deliveries
    after(async () => {
      const order = await prisma.order.findFirst({ where: { wooOrderId: id }, select: { id: true } });
      if (order) await refreshOrderFromWoo({ id: order.id });
    });
  }
  return NextResponse.json({ ok: true });
}
