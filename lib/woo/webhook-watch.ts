import "server-only";
import { sendMail } from "@/lib/email/mailer";
import { wooFetch } from "./client";

const ALERT_TO = "sales1.pronuvia@gmail.com";

type WooWebhook = { id: number; name: string; topic: string; status: string; delivery_url: string };

/**
 * Woo pauses or disables a webhook (e.g. after repeated delivery failures),
 * and then WP admin changes stop reaching Pronuvia until the cron. Our order
 * webhooks (delivering to /api/woo/webhooks) are switched back on here, and
 * the team is told.
 */
export async function ensureOrderWebhooksActive(): Promise<number[]> {
  const { data } = await wooFetch<WooWebhook[]>("wc/v3/webhooks?per_page=100");
  const off = data.filter((h) => h.topic.startsWith("order.") && h.delivery_url.includes("/api/woo/webhooks") && h.status !== "active");
  const fixed: number[] = [];
  for (const h of off) {
    try {
      await wooFetch(`wc/v3/webhooks/${h.id}`, { method: "PUT", body: { status: "active" } });
      fixed.push(h.id);
    } catch (e) {
      console.error(`[webhook-watch] webhook #${h.id} not re-activated:`, e);
    }
  }
  if (off.length) {
    await sendMail({
      to: ALERT_TO, type: "WooCommerce Webhook Alert", relatedId: off.map((h) => `#${h.id}`).join(", "),
      subject: "WooCommerce order webhook was off",
      html: `<p>${off.map((h) => `Webhook #${h.id} "${h.name}" was ${h.status}${fixed.includes(h.id) ? " and has been switched back on" : ", and could not be switched back on: check it in WooCommerce → Settings → Advanced → Webhooks"}.`).join("<br>")}</p><p>Orders changed in WP admin meanwhile are brought up to date by the daily sync (last 7 days).</p>`,
    }).catch((e) => console.error("[webhook-watch] alert email failed:", e));
  }
  return fixed;
}
