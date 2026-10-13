import "server-only";
import { prisma } from "@/lib/db/prisma";
import { wooFetch } from "@/lib/woo/client";
import type { WooOrderDetail } from "@/lib/woo/orders";
import { STATUS_META_KEY, toWooStatus } from "./woo-status";

// Checks our orders against their WooCommerce orders: total, status and the
// money refunded, plus orders that have not reached Woo. For go-live checks
// and day-to-day monitoring (GET /api/woo/reconcile).

export type ReconcileIssue = {
  orderNumber: string;
  wooOrderId:  number | null;
  issue:       string;
  ours?:       string;
  woo?:        string;
};

export type ReconcileReport = {
  days:     number;
  checked:  number;
  ok:       number;
  issues:   ReconcileIssue[];
  webhooks: { name: string; topic: string; status: string; deliveryUrl: string }[];
};

const money = (n: number) => `$${n.toFixed(2)}`;

export async function reconcileOrders(days = 30): Promise<ReconcileReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where:  { createdAt: { gte: since }, OR: [{ wooOrderId: { not: null } }, { wooSyncStatus: { not: null } }] },
    select: { id: true, orderNumber: true, total: true, status: true, wooOrderId: true, wooSyncStatus: true, wooSyncError: true, wooSyncAttempts: true },
    orderBy: { createdAt: "desc" },
  });
  const refunds = await prisma.orderRefund.findMany({
    where:  { orderId: { in: orders.map((o) => o.id) } },
    select: { orderId: true, customerRefundAmount: true },
  });
  const refundedHere = new Map<string, number>();
  for (const r of refunds) refundedHere.set(r.orderId, (refundedHere.get(r.orderId) ?? 0) + (r.customerRefundAmount ?? 0));

  // The Woo orders, 100 per request
  const ids = orders.flatMap((o) => (o.wooOrderId ? [o.wooOrderId] : []));
  const woo = new Map<number, WooOrderDetail>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await wooFetch<WooOrderDetail[]>(`wc/v3/orders?include=${ids.slice(i, i + 100).join(",")}&per_page=100&status=any`);
    for (const w of data) woo.set(w.id, w);
  }

  const issues: ReconcileIssue[] = [];
  for (const o of orders) {
    if (!o.wooOrderId) {
      issues.push({ orderNumber: o.orderNumber, wooOrderId: null, issue: "Not in WooCommerce yet", ours: `${o.wooSyncStatus}, ${o.wooSyncAttempts ?? 0} attempts${o.wooSyncError ? `: ${o.wooSyncError}` : ""}` });
      continue;
    }
    const w = woo.get(o.wooOrderId);
    if (!w) {
      issues.push({ orderNumber: o.orderNumber, wooOrderId: o.wooOrderId, issue: "Woo order missing (deleted or in the trash)" });
      continue;
    }
    if (Math.abs(Number(w.total) - o.total) > 0.005) {
      issues.push({ orderNumber: o.orderNumber, wooOrderId: w.id, issue: "Total differs", ours: money(o.total), woo: money(Number(w.total)) });
    }
    const meta = w.meta_data.find((m) => m.key === STATUS_META_KEY)?.value;
    const inStep = toWooStatus(o.status) === w.status || (o.status === "REFUNDED" && meta === "REFUNDED");
    if (!inStep) issues.push({ orderNumber: o.orderNumber, wooOrderId: w.id, issue: "Status differs", ours: o.status, woo: w.status });
    const wooRefunded = w.refunds.reduce((s, r) => s + Math.abs(Number(r.total)), 0);
    const ours = refundedHere.get(o.id) ?? 0;
    if (Math.abs(wooRefunded - ours) > 0.005) {
      issues.push({ orderNumber: o.orderNumber, wooOrderId: w.id, issue: "Refunded amount differs", ours: money(ours), woo: money(wooRefunded) });
    }
  }

  const { data: hooks } = await wooFetch<{ name: string; topic: string; status: string; delivery_url: string }[]>("wc/v3/webhooks?per_page=100");
  return {
    days,
    checked:  orders.length,
    ok:       orders.length - new Set(issues.map((i) => i.orderNumber)).size,
    issues,
    webhooks: hooks.map((h) => ({ name: h.name, topic: h.topic, status: h.status, deliveryUrl: h.delivery_url })),
  };
}
