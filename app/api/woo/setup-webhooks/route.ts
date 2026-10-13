import { NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";
import { wooFetch } from "@/lib/woo/client";

export const dynamic = "force-dynamic";

// POST /api/woo/setup-webhooks (admin): creates or fixes the WooCommerce
// webhooks this app needs, pointing at NEXT_PUBLIC_APP_URL/api/woo/webhooks
// and signed with WOO_WEBHOOK_SECRET. Safe to run again after a domain or
// secret change. Run it once after deploying.
const TOPICS = ["order.updated", "product.updated", "product.created", "product.deleted"];

type Hook = { id: number; name: string; topic: string; status: string; delivery_url: string };

export async function POST() {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const base   = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const secret = process.env.WOO_WEBHOOK_SECRET;
  if (!secret)                     return NextResponse.json({ error: "Set WOO_WEBHOOK_SECRET first." }, { status: 400 });
  if (!base.startsWith("https://")) return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL must be the public https:// address; Woo cannot reach localhost." }, { status: 400 });
  const url = `${base}/api/woo/webhooks`;

  const { data: hooks } = await wooFetch<Hook[]>("wc/v3/webhooks?per_page=100");
  const result: { topic: string; action: string; id: number }[] = [];
  for (const topic of TOPICS) {
    const body = { name: `Pronuvia ${topic}`, topic, delivery_url: url, secret, status: "active" };
    const mine = hooks.find((h) => h.topic === topic && (h.delivery_url === url || h.name === body.name));
    const saved = mine
      ? (await wooFetch<Hook>(`wc/v3/webhooks/${mine.id}`, { method: "PUT", body })).data
      : (await wooFetch<Hook>("wc/v3/webhooks", { method: "POST", body })).data;
    result.push({ topic, action: mine ? "updated" : "created", id: saved.id });
  }
  // Other webhooks are left alone, but listed so a stale one can be spotted
  const others = hooks.filter((h) => !result.some((r) => r.id === h.id)).map((h) => ({ id: h.id, name: h.name, topic: h.topic, status: h.status, deliveryUrl: h.delivery_url }));
  return NextResponse.json({ deliveryUrl: url, webhooks: result, otherWebhooks: others });
}
