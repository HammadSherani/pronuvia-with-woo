// Moves commission from the wallet to commission lines (lib/commission/lines).
//
//   tsx --conditions=react-server --env-file=.env scripts/migrate-commission-lines.mts --db=<database> --ledger=<file> [--apply]
//
// --ledger: the old site's MLM ledger (wpbr_wallet_balance rows, read from
// login2 with the Inspector plugin). Without --apply nothing is written: it
// only reports what would change. Safe to run again (e.g. on transfer night
// with a fresh ledger): every row has a fixed key, and lines the admin
// already paid / cancelled here are never touched.
//
// What it does:
//   1. Every old-site row with commission becomes an OLD_SITE line of its
//      person (looked up by their WP id):
//        payout_done            → PAID (in a payout-history entry; payouts
//                                 made after our copy get one too)
//        approve, on or before  → NEEDS_REVIEW (the admin pays or cancels)
//          12/31/2025, or the same amount already paid for the same order
//          and person (a likely duplicate)
//        approve, from 1/1/2026 → PENDING (paid with that month's payout)
//      A row that later turned payout_done / rejected on the old site moves
//      along (unless the admin here already decided on it).
//   2. Orders placed on the new portal: their commission lines are built
//      from the order (reconcileOrderCommission).
//   3. The wallet-era payout requests are replaced: every user's pending
//      lines are grouped into one request per commission month.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db/prisma";
import { periodKeyOf, rebuildPayoutRequests, reconcileOrderCommission, type PayoutRole } from "@/lib/commission/lines";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "");
if (arg("db") !== dbName) { console.error(`--db must be the database in DATABASE_URL ("${dbName}")`); process.exit(1); }
const ledgerFile = arg("ledger");
if (!ledgerFile) { console.error("--ledger=<file> is required"); process.exit(1); }
const CUTOFF = "2025-12";   // periods up to and including this month → Needs review

type Row = { id: string; user_id: string; order_id: string; points: string; level: string; created_on: string; status: string; payout_on: string | null; payout_method: string | null; payout_comment: string | null };
const raw = JSON.parse(readFileSync(ledgerFile, "utf8"));
const ledger: Row[] = Array.isArray(raw) ? raw : raw.rows;

const oid = (kind: string, key: string | number) => createHash("sha256").update(`old-wp:${kind}:${key}`).digest("hex").slice(0, 24);
const r2 = (n: number) => Math.round(n * 100) / 100;
const utcTime = (s: string | null) => (!s || s.startsWith("0000") ? null : new Date(s.replace(" ", "T") + "Z"));
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "Commission October 2026" → "2026-10" */
function periodFromComment(c: string | null | undefined): string | null {
  const m = c?.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i);
  return m ? `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}` : null;
}
const stats: Record<string, number> = {};
const bump = (k: string, n = 1) => { stats[k] = r2((stats[k] ?? 0) + n); };

// ── who and which order ──
const [docs, reps] = await Promise.all([
  prisma.partneringPhysician.findMany({ where: { wooCustomerId: { not: null } }, select: { id: true, wooCustomerId: true } }),
  prisma.salesRepresentative.findMany({ where: { wooCustomerId: { not: null } }, select: { id: true, wooCustomerId: true } }),
]);
const person = new Map<number, { id: string; role: PayoutRole }>();
for (const d of docs) person.set(d.wooCustomerId!, { id: d.id, role: "PHYSICIAN" });
for (const r of reps) person.set(r.wooCustomerId!, { id: r.id, role: "SALES_REP" });   // a rep wins (Renee, Robert)

const orderIds = [...new Set(ledger.map((l) => Number(l.order_id)).filter((n) => n > 0))];
const orders = new Map<number, { id: string; orderNumber: string; createdAt: Date }>();
for (let i = 0; i < orderIds.length; i += 2000) {
  for (const o of await prisma.order.findMany({ where: { wooOrderId: { in: orderIds.slice(i, i + 2000) } }, select: { id: true, orderNumber: true, createdAt: true, wooOrderId: true } })) {
    orders.set(o.wooOrderId!, o);
  }
}

// Same order, same person, same amount already paid → a later "approve" of it is a likely duplicate
const paidSig = new Set(ledger.filter((l) => l.status === "payout_done").map((l) => `${l.order_id}:${l.user_id}:${Number(l.points).toFixed(2)}`));

// ── 1. old-site rows → lines ──
type Want = { key: string; userId: string; role: PayoutRole; orderId: string | null; orderNumber: string | null; amount: number; periodKey: string;
              status: "PENDING" | "NEEDS_REVIEW" | "PAID" | "CANCELLED"; note: string; paidAt: Date | null; payoutKey: string | null; createdAt: Date };
const wants: Want[] = [];
const payouts = new Map<string, { id: string; userId: string; role: PayoutRole; at: Date; amount: number; methods: Set<string>; comments: Set<string> }>();

for (const l of ledger) {
  const pts = Number(l.points) || 0;
  if (r2(pts) <= 0) continue;   // also fractions of a cent (old-site rounding leftovers)
  if (!["payout_done", "approve", "rejected"].includes(l.status)) continue;   // pending = awaiting review on the order page
  const who = person.get(Number(l.user_id));
  if (!who) { bump(`skipped: no such person here (${l.status})`); bump(`skipped $ (${l.status})`, pts); continue; }
  const order = orders.get(Number(l.order_id)) ?? null;
  const periodKey = order ? periodKeyOf(order.createdAt) : l.created_on.slice(0, 7);
  const createdAt = order?.createdAt ?? new Date(l.created_on.replace(" ", "T") + "Z");
  const base = { key: `old:${l.id}`, userId: who.id, role: who.role, orderId: order?.id ?? null, orderNumber: order?.orderNumber ?? null, amount: r2(pts), periodKey, createdAt };
  const where = order ? "" : ` · old site order ${l.order_id}`;

  if (l.status === "payout_done") {
    const at = utcTime(l.payout_on) ?? createdAt;
    const method = l.payout_method || "Payout";
    const pk = `${who.id}:${at.toISOString().slice(0, 10)}:${method}`;
    const p = payouts.get(pk) ?? { id: oid("payout", pk), userId: who.id, role: who.role, at, amount: 0, methods: new Set<string>(), comments: new Set<string>() };
    p.amount = r2(p.amount + pts); if (at > p.at) p.at = at; p.methods.add(method); if (l.payout_comment) p.comments.add(l.payout_comment);
    payouts.set(pk, p);
    wants.push({ ...base, status: "PAID", note: `Paid on the old site · ${method}${l.payout_comment ? ` · ${l.payout_comment}` : ""}${where}`, paidAt: at, payoutKey: pk });
  } else if (l.status === "rejected") {
    wants.push({ ...base, status: "CANCELLED", note: `Rejected on the old site${where}`, paidAt: null, payoutKey: null });
  } else {
    const dup = paidSig.has(`${l.order_id}:${l.user_id}:${pts.toFixed(2)}`);
    const old = periodKey <= CUTOFF;
    wants.push({
      ...base, status: old || dup ? "NEEDS_REVIEW" : "PENDING", paidAt: null, payoutKey: null,
      note: `Old site, level ${l.level}${dup ? " · possible duplicate: the same amount was already paid for this order" : ""}${where}`,
    });
  }
}

const existing = new Map<string, { id: string; status: string; payoutId: string | null; orderId: string | null }>();
const keys = wants.map((w) => w.key);
for (let i = 0; i < keys.length; i += 2000) {
  for (const l of await prisma.commissionLine.findMany({ where: { key: { in: keys.slice(i, i + 2000) } }, select: { id: true, key: true, status: true, payoutId: true, orderId: true } })) existing.set(l.key, l);
}

// Payout-history entries: the imported ones, plus payouts made since our copy
const payoutIds = [...payouts.values()].map((p) => p.id);
const havePayouts = new Set<string>();
for (let i = 0; i < payoutIds.length; i += 2000) {
  for (const r of await prisma.withdrawRequest.findMany({ where: { id: { in: payoutIds.slice(i, i + 2000) } }, select: { id: true } })) havePayouts.add(r.id);
}
const newPayouts = [...payouts.values()].filter((p) => !havePayouts.has(p.id));
bump("payout history: new entries (paid on the old site after our copy)", newPayouts.length);
bump("payout history: new entries $", newPayouts.reduce((s, p) => s + p.amount, 0));

const creates: Want[] = [];
const moves: { id: string; to: Want }[] = [];
const linkOrders: { id: string; to: Want }[] = [];
for (const w of wants) {
  const e = existing.get(w.key);
  if (!e) { creates.push(w); bump(`new line ${w.status}`); bump(`new line ${w.status} $`, w.amount); continue; }
  // Its order has been imported since (e.g. on transfer night): link it, in the order's month
  if (!e.orderId && w.orderId) { linkOrders.push({ id: e.id, to: w }); bump("lines linked to their (newly imported) order"); }
  // The old site moved on (paid there / rejected there): follow it, unless decided here
  const decidedHere = e.status === "PAID" ? !w.payoutKey : e.status === "CANCELLED";
  if (e.status !== w.status && !decidedHere && (w.status === "PAID" || w.status === "CANCELLED")) {
    moves.push({ id: e.id, to: w }); bump(`line ${e.status} → ${w.status}`); bump(`line ${e.status} → ${w.status} $`, w.amount);
  }
}

console.log(`\n${apply ? "APPLYING" : "DRY RUN (nothing written)"} on "${dbName}" · ledger rows ${ledger.length}`);

if (apply) {
  for (const p of newPayouts) {
    const comments = [...p.comments];
    await prisma.withdrawRequest.create({
      data: {
        id: p.id, userId: p.userId, userRole: p.role, amount: p.amount, status: "APPROVED", note: "Commission payout",
        adminNote: `Paid on the old site · ${[...p.methods].join(", ")}${comments.length ? ` · ${comments.join("; ").slice(0, 300)}` : ""}`,
        periodKey: periodFromComment(comments[0]) ?? `${p.at.getUTCFullYear()}-${String(p.at.getUTCMonth() + 1).padStart(2, "0")}`,
        snapshotAt: p.at, notificationStatus: "SENT", createdAt: p.at,
      },
    });
  }
  const payoutIdOf = (w: Want) => (w.payoutKey ? payouts.get(w.payoutKey)!.id : null);
  for (let i = 0; i < creates.length; i += 1000) {
    await prisma.commissionLine.createMany({
      data: creates.slice(i, i + 1000).map((w) => ({
        key: w.key, userId: w.userId, userRole: w.role, orderId: w.orderId, orderNumber: w.orderNumber, kind: "OLD_SITE" as const,
        status: w.status, amount: w.amount, periodKey: w.periodKey, payoutId: payoutIdOf(w), note: w.note.slice(0, 500),
        by: "Old site (MLM plugin)", paidAt: w.paidAt, cancelledAt: w.status === "CANCELLED" ? w.createdAt : null, createdAt: w.createdAt,
      })),
    });
  }
  // Lines of less than a cent made by an earlier run: not payable
  const dust = await prisma.commissionLine.deleteMany({ where: { kind: "OLD_SITE", amount: { lt: 0.005 }, status: { in: ["PENDING", "NEEDS_REVIEW"] } } });
  if (dust.count) bump("lines under a cent removed", dust.count);
  for (const m of linkOrders) {
    await prisma.commissionLine.update({ where: { id: m.id }, data: { orderId: m.to.orderId, orderNumber: m.to.orderNumber, periodKey: m.to.periodKey } });
  }
  for (const m of moves) {
    await prisma.commissionLine.update({
      where: { id: m.id },
      data: { status: m.to.status, note: m.to.note.slice(0, 500), paidAt: m.to.paidAt, payoutId: payoutIdOf(m.to), ...(m.to.status === "CANCELLED" && { cancelledAt: new Date() }) },
    });
  }
  // Old payout-history entries: their month from the comment ("Commission October 2026")
  // (one update per month, not per entry: thousands of entries)
  const byMonth = new Map<string, string[]>();
  for (const r of await prisma.withdrawRequest.findMany({ where: { status: "APPROVED", adminNote: { startsWith: "Paid on the old site" } }, select: { id: true, adminNote: true, periodKey: true } })) {
    const k = periodFromComment(r.adminNote);
    if (k && k !== r.periodKey) byMonth.set(k, [...(byMonth.get(k) ?? []), r.id]);
  }
  for (const [k, ids] of byMonth) {
    await prisma.withdrawRequest.updateMany({ where: { id: { in: ids } }, data: { periodKey: k } });
    bump("payout history: month taken from its comment", ids.length);
  }
}

// ── 2. orders placed on the new portal ──
const oldLineOrders = new Set((await prisma.commissionLine.findMany({ where: { kind: "OLD_SITE", orderId: { not: null } }, select: { orderId: true }, distinct: ["orderId"] })).map((l) => l.orderId!));
for (const w of creates) if (w.orderId) oldLineOrders.add(w.orderId);
const native = await prisma.order.findMany({
  where: { commissionPaid: true, OR: [{ physicianCommissionAmount: { gt: 0 } }, { salesRepCommissionAmount: { gt: 0 } }] },
  select: { id: true, orderNumber: true },
});
const toReconcile = native.filter((o) => !oldLineOrders.has(o.id));
bump("new-portal orders with approved commission (lines built from the order)", toReconcile.length);
if (apply) for (const o of toReconcile) await reconcileOrderCommission(o.id);

// ── 3. payout requests: one per user and commission month ──
const walletEra = await prisma.withdrawRequest.findMany({ where: { status: "PENDING" }, select: { id: true, userId: true, userRole: true, amount: true } });
bump("wallet-era pending payout requests replaced", walletEra.length);
bump("wallet-era pending payout requests $", walletEra.reduce((s, r) => s + r.amount, 0));
if (apply) {
  const withLines = new Set((await prisma.commissionLine.findMany({ where: { payoutId: { in: walletEra.map((r) => r.id) } }, select: { payoutId: true } })).map((l) => l.payoutId));
  await prisma.withdrawRequest.deleteMany({ where: { id: { in: walletEra.filter((r) => !withLines.has(r.id)).map((r) => r.id) }, status: "PENDING" } });
  const users = await prisma.commissionLine.groupBy({ by: ["userId", "userRole"], where: { status: "PENDING" } });
  for (const u of users) await rebuildPayoutRequests(u.userId, u.userRole as PayoutRole);
  const after = await prisma.withdrawRequest.aggregate({ where: { status: "PENDING" }, _count: true, _sum: { amount: true } });
  bump("payout requests now (one per user and month)", after._count);
  bump("payout requests now $", after._sum.amount ?? 0);
  const review = await prisma.commissionLine.aggregate({ where: { status: "NEEDS_REVIEW" }, _count: true, _sum: { amount: true } });
  bump("needs review now", review._count);
  bump("needs review now $", review._sum.amount ?? 0);
}

for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(72)} ${v}`);
await prisma.$disconnect();
