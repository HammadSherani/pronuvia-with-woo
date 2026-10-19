// One-time (safe to run again): fills the Commission History of orders whose
// review happened before it was recorded, from
//   - the plugin's notes on the WP order ("Doctor commission approved: $72.00." …),
//   - the wallet entries ("Commission for order", "Commission adjusted"),
//   - commission refunds, and the payout (paid-out date).
// Only what happened before the order's first recorded review row is taken,
// so nothing shows twice. Every row has a fixed key: a second run adds nothing.
//
//   tsx --conditions=react-server --env-file=.env scripts/backfill-commission-history.mts --dry
//   tsx --conditions=react-server --env-file=.env scripts/backfill-commission-history.mts
import { prisma } from "@/lib/db/prisma";
import { recordCommissionEvent, type CommissionEventInput } from "@/lib/orders/commission-history";
import { getWooOrderNotes } from "@/lib/woo/orders";

const dry = process.argv.includes("--dry");
const ROLES = [
  { role: "PHYSICIAN" as const, label: "Doctor", amount: "physicianCommissionAmount", original: "physicianCommissionOriginal", paidOut: "physicianCommissionPaidOutAt", user: "physicianId" },
  { role: "SALES_REP" as const, label: "Sales Rep", amount: "salesRepCommissionAmount", original: "salesRepCommissionOriginal", paidOut: "salesRepCommissionPaidOutAt", user: "salesRepId" },
] as const;
const LIVE_SOURCES = ["note:", "tx:", "in-payout:", "paid-out:", "refund:"];
const decode = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&#36;/g, "$").replace(/&amp;/g, "&").replace(/&#039;|&#8217;/g, "'").replace(/&quot;/g, '"').trim();
const num = (s: string) => Number(s.replace(/,/g, ""));
const MONEY = String.raw`\$([\d,]+(?:\.\d{1,2})?)`;

const orders = await prisma.order.findMany({
  where: { OR: [{ physicianCommissionReview: { not: null } }, { salesRepCommissionReview: { not: null } }, { commissionPaid: true }] },
  orderBy: { createdAt: "asc" },
});

let total = 0;
for (const o of orders) {
  const notes = o.wooOrderId ? await getWooOrderNotes(o.wooOrderId).catch(() => []) : [];
  const existing = await prisma.commissionEvent.findMany({ where: { orderId: o.id }, select: { key: true, userRole: true, createdAt: true } });
  const txs = await prisma.walletTransaction.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } });
  const refunds = await prisma.commissionRefund.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } });
  const rows: CommissionEventInput[] = [];

  for (const r of ROLES) {
    if (!o[r.user]) continue;
    // Recorded live from here on (review rows written by the new code)
    const live = existing.filter((e) => e.userRole === r.role && !LIVE_SOURCES.some((p) => e.key.startsWith(p)));
    const cutoff = live.length ? Math.min(...live.map((e) => e.createdAt.getTime())) : Infinity;

    for (const n of [...notes].reverse()) {
      const at = new Date(`${n.date_created_gmt}Z`);
      if (at.getTime() >= cutoff) continue;
      const text = decode(n.note);
      if (!text.startsWith(`${r.label} commission `)) continue;
      const note = text.match(/ Note: (.*)$/)?.[1] ?? null;
      const base = { key: `note:${o.id}:${n.id}`, orderId: o.id, userRole: r.role, note, by: (n as { author?: string }).author ?? null, createdAt: at };
      let m;
      if ((m = text.match(new RegExp(`commission approved: ${MONEY}`))))                   rows.push({ ...base, action: "APPROVED", amount: num(m[1]) });
      else if ((m = text.match(new RegExp(String.raw`commission rejected \(${MONEY}\)`))))        rows.push({ ...base, action: "REJECTED", amount: num(m[1]) });
      else if ((m = text.match(new RegExp(`commission modified: ${MONEY} → ${MONEY}`))))   rows.push({ ...base, action: "MODIFIED", amount: num(m[2]), previousAmount: num(m[1]) });
    }

    for (const t of txs.filter((t) => t.userRole === r.role && t.createdAt.getTime() < cutoff)) {
      const signed = t.type === "CREDIT" ? t.amount : -t.amount;
      if (t.description?.startsWith("Commission for order")) {
        rows.push({ key: `in-payout:${o.id}:${r.role}`, orderId: o.id, userRole: r.role, action: "IN_PAYOUT", amount: t.amount, walletChange: signed, createdAt: t.createdAt });
      } else if (t.description?.startsWith("Commission adjusted")) {
        // The wallet change goes on the review it came from: the latest one
        // before it (the webhook lands a little after the WP click)
        // (the same kind of review: "rejected", "approved" or "changed to $X")
        const why = t.description.match(/\((rejected|approved|changed to \$([\d,.]+))/);
        const open = rows.filter((x) => x.userRole === r.role && x.key!.startsWith("note:") && x.walletChange == null && x.createdAt! <= t.createdAt);
        const kind = (x: CommissionEventInput) => !why ? true
          : why[1] === "rejected" ? x.action === "REJECTED"
          : why[1] === "approved" ? x.action === "APPROVED"
          : x.action === "MODIFIED" && x.amount === num(why[2]);
        const review = open.filter(kind).pop() ?? open.pop();
        if (review) review.walletChange = signed;
        else rows.push({ key: `tx:${t.id}`, orderId: o.id, userRole: r.role, action: "ADJUSTED", amount: o[r.amount], walletChange: signed, note: t.description.match(/\((.*)\)$/)?.[1] ?? null, createdAt: t.createdAt });
      }
    }

    let left = o[r.amount];
    for (const f of refunds.filter((f) => f.userRole === r.role)) {
      rows.push({ key: `refund:${f.key}`, orderId: o.id, userRole: r.role, action: "REFUNDED", amount: Number((left - f.amount).toFixed(2)), previousAmount: left, walletChange: -f.amount, note: f.note, by: f.by, createdAt: f.createdAt });
      left = Number((left - f.amount).toFixed(2));
    }

    const paidOutAt = o[r.paidOut];
    if (paidOutAt && !existing.some((e) => e.key.startsWith(`paid-out:${o.id}:${r.role}:`))) {
      rows.push({ key: `paid-out:${o.id}:${r.role}:backfill`, orderId: o.id, userRole: r.role, action: "PAID_OUT", amount: o[r.amount], createdAt: paidOutAt });
    }
  }

  const fresh = rows.filter((x) => !existing.some((e) => e.key === x.key));
  if (!fresh.length) continue;
  console.log(`\n${o.orderNumber} (woo #${o.wooOrderId ?? "-"})`);
  for (const x of fresh.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())) {
    console.log(`  ${x.createdAt!.toISOString().slice(0, 16)}  ${x.userRole.padEnd(9)} ${x.action.padEnd(9)} $${x.amount.toFixed(2)}${x.previousAmount != null ? ` (was $${x.previousAmount.toFixed(2)})` : ""}${x.walletChange ? `  wallet ${x.walletChange > 0 ? "+" : ""}${x.walletChange.toFixed(2)}` : ""}${x.note ? `  "${x.note}"` : ""}`);
    if (!dry) await recordCommissionEvent(x);
    total++;
  }
}
console.log(`\n${total} history rows ${dry ? "would be added (dry run: nothing changed)" : "added"}.`);
await prisma.$disconnect();
