// One-time (safe to run again): the tracking numbers of the orders brought
// over from the old WordPress site (scripts/import-old-site.mts), which the
// import left out. The old site kept them in several places:
//   1. shipping labels: `wcshipping_labels`, older `wc_connect_labels`
//      → WooLabel rows already marked notified (so no refresh ever emails
//        them) and the newest outbound one on the order;
//   2. `_wc_shipment_tracking_items` (Shipment Tracking);
//   3. the FedEx plugin (`wf_woo_fedex_shipmentId`, `wffedextrackingmsg`);
//   4. the order's customer notes, e.g. "FedEx 2nd Day 621331003321",
//      read from WooCommerce (read only) and kept in notes.json.
// Only orders without tracking are filled. Nothing is emailed, nothing is
// written to WooCommerce, no order status changes.
//
//   tsx --conditions=react-server --env-file=.env scripts/import-old-tracking.mts --db=<database> --dry
//   tsx --conditions=react-server --env-file=.env scripts/import-old-tracking.mts --db=<database>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/db/prisma";
import { wooFetch } from "@/lib/woo/client";
import { carrierName, parseWooLabels, type WooLabelData } from "@/lib/orders/woo-labels";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dry  = process.argv.includes("--dry");
const DATA = arg("data") ?? "D:/claude-tmp/old-site";
const NOTES = `${DATA}/notes.json`;

const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "");
if (arg("db") !== dbName) {
  console.error(`--db must be the database in DATABASE_URL ("${dbName}")`);
  process.exit(1);
}

type Meta = { key: string; value: unknown }[];
type OldOrder = { id: number; number: string; status: string; created: string; meta: Meta };
type Note = { date_created_gmt: string; note: string; customer_note: boolean };
type Found = { tracking: string; carrier: string; source: string; labels?: WooLabelData[] };

const orders: OldOrder[] = JSON.parse(readFileSync(`${DATA}/orders.json`, "utf8"));
const metaOf = (o: OldOrder, key: string) => o.meta.find((m) => m.key === key)?.value;
const list = (v: unknown): Record<string, unknown>[] => {
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v : [];
};

// A carrier from the tracking number's shape, when the text doesn't name one
function carrierOf(number: string): string {
  if (/^1Z/i.test(number)) return "UPS";
  if (/^9\d{19,21}$/.test(number)) return "USPS";
  return "FedEx";
}

/** "FedEx 2nd Day 621331003321" → FedEx - 2nd Day / 621331003321 (the last match in the text). */
function fromText(text: string): { tracking: string; carrier: string } | null {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#\d+;/g, " ")
    // "9779 4350 2731" → one number
    .replace(/(\d{4}) (?=\d{4}\b)/g, "$1");
  // The number may follow a word with no space ("Ground977943500897")
  const re = /\b(fed\s?ex|ups|usps|dhl)?\b([^\n\d#]{0,40}?)[\s#:]*(?<!\d)(1Z[0-9A-Z]{16}|\d{10,22})(?!\d)/gi;
  let best: { tracking: string; carrier: string } | null = null;
  for (const m of plain.matchAll(re)) {
    const number = m[3].toUpperCase();
    // Without a carrier named, a short number may be a phone number
    if (!m[1] && /^\d{10,11}$/.test(number)) continue;
    const named = m[1] ? ({ fedex: "FedEx", ups: "UPS", usps: "USPS", dhl: "DHL" } as Record<string, string>)[m[1].toLowerCase().replace(/\s+/g, "")] ?? m[1] : "";
    const service = m[1] ? m[2].replace(/tracking|number|no\.?|via|is|:/gi, " ").replace(/\s+/g, " ").trim() : "";
    const carrier = named || carrierOf(number);
    best = { tracking: number, carrier: service ? `${carrier} - ${service}` : carrier };
  }
  return best;
}

function fromMeta(o: OldOrder): Found | null {
  for (const key of ["wcshipping_labels", "wc_connect_labels"]) {
    const labels = parseWooLabels(list(metaOf(o, key)));
    const out = labels.filter((l) => !l.isReturn && !l.refunded).sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
    if (out.length) return { tracking: out[0].tracking, carrier: `${carrierName(out[0].carrier)} - ${out[0].service}`, source: key, labels };
  }
  const items = list(metaOf(o, "_wc_shipment_tracking_items")).filter((t) => t.tracking_number);
  if (items.length) {
    const t = items[items.length - 1];
    const provider = String(t.custom_tracking_provider || t.tracking_provider || "") || carrierOf(String(t.tracking_number));
    return { tracking: String(t.tracking_number).trim(), carrier: provider, source: "_wc_shipment_tracking_items" };
  }
  const fedexId = o.meta.find((m) => m.key === "wf_woo_fedex_shipmentId")?.value;
  if (fedexId) return { tracking: String(Array.isArray(fedexId) ? fedexId[0] : fedexId), carrier: "FedEx", source: "fedex plugin" };
  const msg = metaOf(o, "wffedextrackingmsg");
  const m = typeof msg === "string" ? /tracknumbers=([0-9A-Z,]+)/i.exec(msg) : null;
  if (m) return { tracking: m[1].split(",")[0], carrier: "FedEx", source: "fedex plugin" };
  return null;
}

// ── the orders to fill: brought over from the old site, still without tracking ──

const ours = await prisma.order.findMany({
  where:  { wooOrderId: { in: orders.map((o) => o.id) } },
  select: { id: true, wooOrderId: true, trackingNumber: true },
});
const byWoo = new Map(ours.map((o) => [o.wooOrderId!, o]));
const todo = orders.filter((o) => byWoo.has(o.id) && !byWoo.get(o.id)!.trackingNumber);
console.log(`Database: ${dbName}${dry ? " (dry run)" : ""} · old orders here: ${ours.length} · without tracking: ${todo.length}`);

// ── customer notes (read once from WooCommerce, cached) ──

const notes: Record<string, Note[]> = existsSync(NOTES) ? JSON.parse(readFileSync(NOTES, "utf8")) : {};
const needNotes = todo.filter((o) => !fromMeta(o) && o.status !== "failed" && !notes[o.id]);
if (needNotes.length) console.log(`reading the notes of ${needNotes.length} orders from WooCommerce…`);
for (let i = 0; i < needNotes.length; i += 6) {
  await Promise.all(needNotes.slice(i, i + 6).map(async (o) => {
    try {
      const { data } = await wooFetch<Note[]>(`wc/v3/orders/${o.id}/notes`);
      notes[o.id] = data.map((n) => ({ date_created_gmt: n.date_created_gmt, note: n.note, customer_note: n.customer_note }));
    } catch (e) {
      console.error(`notes of #${o.number}:`, e instanceof Error ? e.message : e);
    }
  }));
  if (i % 300 === 0 || i + 6 >= needNotes.length) {
    writeFileSync(NOTES, JSON.stringify(notes));
    process.stdout.write(`\r  ${Math.min(i + 6, needNotes.length)}/${needNotes.length}`);
  }
}
if (needNotes.length) console.log();

// ── what each order gets ──

const counts: Record<string, number> = {};
const missing: Record<string, number> = {};
const unparsed: string[] = [];
const plan: { o: OldOrder; f: Found }[] = [];
for (const o of todo) {
  let f = fromMeta(o);
  if (!f) {
    const cust = (notes[o.id] ?? []).filter((n) => n.customer_note).sort((a, b) => a.date_created_gmt.localeCompare(b.date_created_gmt));
    for (const n of cust) {
      const t = fromText(n.note);
      if (t) f = { ...t, source: "customer note" };
    }
    if (!f && cust.length && unparsed.length < 20) unparsed.push(`#${o.number}: ${cust.map((n) => n.note.replace(/\s+/g, " ").slice(0, 100)).join(" | ")}`);
  }
  if (!f) {
    if (o.status === "completed") missing[o.created.slice(0, 4)] = (missing[o.created.slice(0, 4)] ?? 0) + 1;
    continue;
  }
  counts[f.source] = (counts[f.source] ?? 0) + 1;
  plan.push({ o, f });
}

// ── write (database only) ──

// A write conflict (the app updating the same order at that moment) is tried again
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 5 || (e as { code?: string }).code !== "P2034") throw e;
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
}

let labelsMade = 0, done = 0;
if (!dry) {
  const one = async ({ o, f }: { o: OldOrder; f: Found }) => {
    const order = byWoo.get(o.id)!;
    for (const l of f.labels ?? []) {
      await retry(() => prisma.wooLabel.upsert({
        where:  { orderId_labelId: { orderId: order.id, labelId: l.labelId } },
        // Already notified: the old site's customers had their tracking then
        create: { orderId: order.id, ...l, notifiedAt: l.purchasedAt },
        update: {},
      }));
      labelsMade++;
    }
    await retry(() => prisma.order.updateMany({
      where: { id: order.id, OR: [{ trackingNumber: null }, { trackingNumber: { isSet: false } }, { trackingNumber: "" }] },
      data:  { trackingNumber: f.tracking, shippingCarrier: f.carrier },
    }));
    if (++done % 200 === 0) process.stdout.write(`\r  ${done}/${plan.length}`);
  };
  for (let i = 0; i < plan.length; i += 4) await Promise.all(plan.slice(i, i + 4).map(one));
  console.log();
}

console.log("\n== Report");
console.log("orders filled, by source:", counts, `(total ${plan.length})${dry ? " — dry run, nothing written" : ""}`);
if (!dry) console.log(`label rows (marked notified, no email): ${labelsMade}`);
console.log("completed orders still without tracking, by year:", missing);
for (const s of ["13685", "9908", "12524", "11674"]) {
  const p = plan.find((x) => x.o.number === s);
  console.log(`  #${s}: ${p ? `${p.f.tracking} · ${p.f.carrier} (${p.f.source})` : "—"}`);
}
if (unparsed.length) console.log(`\ncustomer notes with no tracking found (first ${unparsed.length}):\n` + unparsed.join("\n"));
await prisma.$disconnect();
