// One-time (safe to run again): brings the old WordPress site
// (login2.pronuvia.com) into Pronuvia, from the files the "Pronuvia Data
// Inspector" plugin gave (D:/claude-tmp/e2e/inspect-old-site.mjs):
//   - reps (mlm_medial_rep) and doctors (mlm_doctor), their rep, commission %,
//     profile and WordPress password hash (they log in with their old password);
//     accounts with no role come in as doctors pending approval;
//   - every order, with its commission from the MLM plugin's ledger
//     (wpbr_wallet_balance): paid out → approved and paid out; approved but not
//     paid → into the wallet and Commission Payout; pending → awaiting review;
//     rejected → rejected;
//   - the payouts made on the old site (payout history and statements);
//   - the old refunds, so the order refresh never takes them for new ones.
// Old orders get no stripePaymentIntentId: nothing here can ever send a card
// refund for them. Every record has an id made from the old site's id, so a
// second run only adds what is missing (and sets passwords that came later).
//
//   tsx --conditions=react-server --env-file=.env scripts/import-old-site.mts --db=<database> --dry
//   tsx --conditions=react-server --env-file=.env scripts/import-old-site.mts --db=<database> [--wipe-test]
// --db must name the database in DATABASE_URL (a guard against the wrong one).
// --wipe-test first deletes the test doctors, reps, orders, wallets, payouts
// and commission history (admins, banners, blogs, coupons stay).
// --woo-review-meta writes the commission review meta on the orders awaiting
// review in WooCommerce (WOO_URL), so the WP Commissions box can approve them;
// never on the live site (refused when WOO_URL is login2.pronuvia.com).
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { fromWooAddress } from "@/lib/orders/order-woo";
import { updateWooOrder, type WooOrderAddress } from "@/lib/woo/orders";
import { NAME_META_KEYS, REVIEW_META_KEY, reviewMetaFor } from "@/lib/orders/commission-review";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dry  = process.argv.includes("--dry");
const wipe = process.argv.includes("--wipe-test");
const reviewMeta = process.argv.includes("--woo-review-meta");
const DATA = arg("data") ?? "D:/claude-tmp/old-site";
const TZ   = "America/New_York";   // the old site's timezone (MLM ledger dates)

const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "");
if (arg("db") !== dbName) {
  console.error(`--db must be the database in DATABASE_URL ("${dbName}")`);
  process.exit(1);
}

// ── the old site's data ──

type Meta = Record<string, unknown>;
type OldUser = { id: number; login: string; email: string; name: string; registered: string; roles: string[]; meta: Meta };
type OldItem = { name: string; product_id: number; variation_id: number; sku: string | null; qty: number; subtotal: string; total: string; meta: { key: string; value: unknown }[] };
type OldRefund = { id: number; amount: string; reason: string; date: string | null; items: { product_id: number; variation_id: number; qty: number; total: string }[] };
type OldOrder = {
  id: number; number: string; status: string; created: string; paid: string | null; completed: string | null;
  total: string; subtotal: number; shipping_total: string; discount_total: string; tax_total: string; refunded: number;
  payment: string; customer_id: number; billing: WooOrderAddress & { email?: string }; shipping: WooOrderAddress;
  shipping_lines: { method: string; total: string }[]; coupons: string[]; customer_note: string;
  items: OldItem[]; refunds?: OldRefund[]; meta: { key: string; value: unknown }[];
};
type Ledger = { id: string; user_id: string; order_id: string; points: string; level: string; created_on: string; status: string; payout_on: string | null; payout_method: string | null; payout_comment: string | null };

const read = <T,>(f: string): T => JSON.parse(readFileSync(`${DATA}/${f}`, "utf8"));
const users   = read<OldUser[]>("users.json");
const orders  = read<OldOrder[]>("orders.json");
const ledger  = read<Ledger[]>("tables/wpbr_wallet_balance.json");
const hashes  = new Map<number, string>(existsSync(`${DATA}/passwords.json`)
  ? read<{ users: { id: number; hash: string }[] }>("passwords.json").users.filter((u) => u.hash).map((u) => [u.id, u.hash])
  : []);

// ── helpers ──

/** A Mongo id made from the old site's id: the same record gets the same id every run. */
const oid = (kind: string, key: string | number) => createHash("sha256").update(`old-wp:${kind}:${key}`).digest("hex").slice(0, 24);
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown) => (one(v) == null ? "" : String(one(v)).trim());
const num = (v: unknown) => { const n = Number(str(v)); return Number.isFinite(n) ? n : 0; };
const r2  = (n: number) => Math.round(n * 100) / 100;
const metaOf = (o: { meta: { key: string; value: unknown }[] }, key: string) => o.meta.find((m) => m.key === key)?.value;
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** "2024-03-05 10:20:30" in the old site's timezone → the moment. */
function siteTime(s: string): Date {
  const guess = Date.parse(s.replace(" ", "T") + "Z");
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
    .formatToParts(guess).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
  return new Date(guess - offset);
}
const utcTime = (s: string | null) => (!s || s.startsWith("0000") ? null : new Date(s.replace(" ", "T") + "Z"));

const LOGIN_OK = /^[a-z0-9._@+-]{3,64}$/;
const takenLogins = new Set<string>();
/** The old username as a Login ID (characters it can't have become "."), unique. */
function loginIdFor(u: OldUser): string {
  let base = u.login.toLowerCase().replace(/[^a-z0-9._@+-]+/g, ".").replace(/\.{2,}/g, ".").replace(/^[.\-]+|[.\-]+$/g, "");
  if (base.length < 3) base = (u.email.split("@")[0] || `user${u.id}`).toLowerCase().replace(/[^a-z0-9._+-]+/g, ".");
  base = base.slice(0, 60);
  let id = base;
  for (let n = 2; takenLogins.has(id) || !LOGIN_OK.test(id); n++) id = `${base}-${n}`;
  takenLogins.add(id);
  return id;
}

/** A password nobody knows, for accounts without a usable hash (they reset it).
 * Cost 4 marks it ($2b$04$): a later run with the hashes replaces it. */
const PLACEHOLDER = "$2b$04$";
const placeholder = () => bcrypt.hashSync(randomBytes(24).toString("hex"), 4);

function address(a: WooOrderAddress | undefined): string | null {
  if (!a || (!a.address_1 && !a.city && !a.first_name)) return null;
  return JSON.stringify(fromWooAddress({ ...a, phone: a.phone ?? "" }));
}

const report: Record<string, number> = {};
const bump = (k: string, n = 1) => { report[k] = (report[k] ?? 0) + n; };
const notes: string[] = [];

// ── users ──

type Kind = "rep" | "doctor" | "empty";
// Accounts saved with both a doctor and a rep role (WordPress reads the doctor
// one) that the client confirmed are sales reps: Robert Gear, Renee Schwartz
const REP_ACCOUNTS = new Set([188, 309]);
function kindOf(u: OldUser): Kind | null {
  if (u.roles.includes("administrator") || u.id === 3) return null;   // admins and the company account
  if (u.roles.includes("mlm_medial_rep") || REP_ACCOUNTS.has(u.id)) return "rep";
  if (u.roles.includes("mlm_doctor")) return "doctor";
  if (u.roles.length === 0) return "empty";
  return null;
}
const byWpId = new Map(users.map((u) => [u.id, u]));
const kinds  = new Map<number, Kind>();
for (const u of users) { const k = kindOf(u); if (k) kinds.set(u.id, k); else bump("users skipped (admin / other role)"); }
const isRep = (wpId: number) => kinds.get(wpId) === "rep";
const isDoctor = (wpId: number) => kinds.get(wpId) === "doctor" || kinds.get(wpId) === "empty";
const repOid = (wpId: number) => oid("rep", wpId);
const docOid = (wpId: number) => oid("doctor", wpId);

const repRows: Record<string, unknown>[] = [];
const docRows: Record<string, unknown>[] = [];
const sortedUsers = [...users].sort((a, b) => a.id - b.id);   // older accounts keep the plain Login ID
for (const u of sortedUsers) {
  const k = kinds.get(u.id);
  if (!k) continue;
  const m = u.meta;
  const hash = hashes.get(u.id);
  const loginId = loginIdFor(u);
  if (loginId !== u.login.toLowerCase()) notes.push(`Login ID ${u.login} → ${loginId} (${u.email})`);
  const firstName = str(m.first_name) || str(m.billing_first_name) || u.name || u.login;
  const lastName  = str(m.last_name) || str(m.billing_last_name);
  const createdAt = utcTime(u.registered) ?? new Date();
  const common = {
    email: u.email.toLowerCase(), loginId,
    password: hash ?? placeholder(),
    firstName: k === "empty" && !str(m.first_name) ? (u.email.split("@")[0] || u.login) : firstName,
    lastName, wooCustomerId: u.id, createdAt, updatedAt: createdAt,
  };
  if (!hash) bump(`${k}s without a password hash (use Forgot password)`);

  if (k === "rep") {
    const billing = str(m.billing_address_1) ? JSON.stringify({
      firstName, lastName, phone: str(m.billing_phone), address1: str(m.billing_address_1), address2: str(m.billing_address_2),
      city: str(m.billing_city), state: str(m.billing_state), stateName: str(m.billing_state), zip: str(m.billing_postcode),
      country: str(m.billing_country) || "US", countryName: "",
    }) : null;
    repRows.push({
      id: repOid(u.id), ...common, name: `${firstName} ${lastName}`.trim(),
      phone: str(m.phone_number) || str(m.billing_phone) || null, website: str(m.user_url) || null,
      commission: num(m.com_lev_0), billingAddress: billing, shippingAddress: billing,
    });
    bump("reps");
    continue;
  }

  // The first parent, unless a later one is one of the rep accounts above
  const parents = ([] as unknown[]).concat(m.parent_user ?? []).map(Number);
  const parent = parents.find((p) => REP_ACCOUNTS.has(p)) ?? parents[0];
  const approved = ([] as unknown[]).concat(m.is_admin_approved ?? []).map(String).includes("yes");
  const specialty = str(m["field-specialty"]);
  const years = parseInt(str(m["years-practice"]), 10);
  docRows.push({
    id: docOid(u.id), ...common,
    isApproved: k === "doctor" && approved ? "APPROVED" : "PENDING",
    license: str(m["license-number"]) || null, credential: specialty || null,
    fieldsOfSpeciality: specialty ? [specialty] : [],
    nameOfPractice: str(m["practice-name"]) || null, yearsInPractice: Number.isFinite(years) ? years : null,
    phone: str(m.phone_number) || str(m.billing_phone) || null, officeContactNumber: str(m.office_contact) || null,
    fax: str(m.fax) || null, websiteLink: str(m.user_url) || null,
    addressOne: str(m.address) || null, addressTwo: str(m.address2) || null, city: str(m.city) || null,
    state: str(m.state) || null, zipCode: str(m.zip) || null, country: str(m.country) || (k === "doctor" ? "United States" : null),
    commission: num(m.com_lev_0), uplineCommission: isRep(parent) ? num(m.com_lev_1) : 0,
    salesRepId: isRep(parent) ? repOid(parent) : null,
    addedByRole: "PHYSICIAN", walletBalance: 0, hasCustomPassword: !!hash,
  });
  bump(k === "doctor" ? "doctors" : "doctors pending (accounts with no role)");
  if (k === "doctor" && isRep(parent)) bump("doctors under a rep");
  else if (k === "doctor") bump("doctors under the company (no rep)");
  if (k === "doctor" && str(m.com_lev_0) === "") notes.push(`Doctor ${u.email}: no commission % on the old site (set to 0)`);
}

// ── orders and their commission ──

const ledgerByOrder = new Map<string, Ledger[]>();
for (const l of ledger) {
  const list = ledgerByOrder.get(l.order_id) ?? [];
  list.push(l);
  ledgerByOrder.set(l.order_id, list);
}
const orderOid = (wooId: number) => oid("order", wooId);
// Ledger rows that belong to the order they name. The old site once merged in
// another site's data, so some rows name an order id that is now a different
// order: those were paid, but are not linked to the order here.
const matchedRows = new Set<string>();

const STATUS: Record<string, string> = {
  completed: "COMPLETED", processing: "PROCESSING", refunded: "REFUNDED", cancelled: "CANCELLED", failed: "CANCELLED",
  "on-hold": "PROCESSING", pending: "PENDING", shipped: "SHIPPED",
};
const REVIEW: Record<string, string> = { payout_done: "APPROVED", approve: "APPROVED", rejected: "REJECTED", pending: "AWAITING" };

function payment(title: string): string | null {
  if (!title) return null;
  if (/stripe|card|apple pay|google pay|link|payment request/i.test(title)) return "CARD";
  return title;
}

const orderRows: Record<string, unknown>[] = [];
const refundRows: Record<string, unknown>[] = [];
const eventRows: Record<string, unknown>[] = [];
const awaitingWooIds: number[] = [];

for (const o of orders) {
  const cust = o.customer_id || 0;
  const physicianId = isDoctor(cust) ? docOid(cust) : null;
  const doctorParent = isDoctor(cust) ? Number(str(byWpId.get(cust)?.meta.parent_user)) : 0;
  let salesRepId = isRep(cust) ? repOid(cust) : isRep(doctorParent) ? repOid(doctorParent) : null;
  if (!physicianId && !isRep(cust)) bump(cust ? "orders by an admin / other account (no doctor)" : "guest orders (no doctor)");

  const items = o.items.map((i) => {
    const m = /^(.*?)\s+-\s+(.+)$/.exec(i.name);
    const size = str(i.meta.find((x) => /volume|size/i.test(x.key))?.value) || (m?.[2] ?? "");
    const lineTotal = Number(i.subtotal);
    return {
      productId: String(i.product_id), variationId: i.variation_id || null,
      title: m ? m[1].trim() : i.name, variantSize: size, sku: i.sku ?? "",
      quantity: i.qty, unitPrice: r2(lineTotal / (i.qty || 1)), lineTotal,
    };
  });

  // Commission from the ledger rows of this order
  const rows = ledgerByOrder.get(String(o.id)) ?? [];
  const base = Number(str(metaOf(o, "order_ttl_2"))) || o.subtotal;
  const c = {
    physicianCommissionRate: 0, physicianCommissionAmount: 0, physicianCommissionReview: null as string | null, physicianCommissionPaidOutAt: null as Date | null,
    salesRepCommissionRate: 0, salesRepCommissionAmount: 0, salesRepCommissionReview: null as string | null, salesRepCommissionPaidOutAt: null as Date | null,
  };
  let anyPending = false;
  let creditedAt: Date | null = null;
  for (const l of rows) {
    const uid = Number(l.user_id);
    const pts = Number(l.points) || 0;
    // $0 rows (e.g. a doctor with no commission) need no review
    if (pts <= 0) { bump("ledger rows of $0 (skipped)"); continue; }
    const role = l.level === "0" && isDoctor(uid) && (!physicianId || docOid(uid) === physicianId) ? "PHYSICIAN"
      : l.level === "1" && isRep(uid) ? "SALES_REP" : null;
    if (!role) {
      bump(!kinds.has(uid) ? "ledger rows of deleted / company / admin accounts (not shown on orders)" : `ledger rows at level ${l.level} not matching the order (wallet / payout history only)`);
      continue;
    }
    matchedRows.add(l.id);
    const p = role === "PHYSICIAN" ? "physician" : "salesRep";
    c[`${p}CommissionAmount`] = r2(c[`${p}CommissionAmount`] + pts);
    c[`${p}CommissionRate`] = role === "PHYSICIAN" && num(metaOf(o, "order_com_to_usr")) ? num(metaOf(o, "order_com_to_usr")) : (base ? r2((pts / base) * 100) : 0);
    // Several rows for one role (rare): pending wins, then approved-unpaid
    const review = REVIEW[l.status] ?? "APPROVED";
    const current = c[`${p}CommissionReview`];
    if (!current || review === "AWAITING" || (current === "REJECTED" && review === "APPROVED")) c[`${p}CommissionReview`] = review;
    if (l.status === "payout_done") c[`${p}CommissionPaidOutAt`] = utcTime(l.payout_on);
    if (l.status === "pending") anyPending = true;
    if (l.status === "payout_done" || l.status === "approve") {
      const at = siteTime(l.created_on);
      if (!creditedAt || at < creditedAt) creditedAt = at;
    }
    if (role === "SALES_REP" && !salesRepId) salesRepId = repOid(uid);
    eventRows.push({
      id: oid("event", l.id), key: `old-wp:ledger:${l.id}`, orderId: orderOid(o.id), userRole: role,
      action: { payout_done: "PAID_OUT", approve: "APPROVED", rejected: "REJECTED", pending: "PENDING" }[l.status] ?? "APPROVED",
      amount: pts, note: `Old site${l.payout_method ? ` · ${l.payout_method}` : ""}${l.payout_comment ? ` · ${l.payout_comment}` : ""}`,
      by: "Old site (MLM plugin)",
      createdAt: l.status === "payout_done" ? (utcTime(l.payout_on) ?? siteTime(l.created_on)) : siteTime(l.created_on),
    });
  }
  if (anyPending) awaitingWooIds.push(o.id);

  // Old refunds, so the refresh knows them (no wallet / card effect)
  const refunds = [...(o.refunds ?? [])].sort((a, b) => a.id - b.id);
  refunds.forEach((r, idx) => {
    const lines = r.items.flatMap((ri) => {
      const index = items.findIndex((it) => (it.variationId ? it.variationId === ri.variation_id : Number(it.productId) === ri.product_id));
      return index < 0 ? [] : [{ index, returnedQty: Math.abs(ri.qty), lineTotal: Math.abs(Number(ri.total)) }];
    });
    refundRows.push({
      id: oid("refund", r.id), orderId: orderOid(o.id), refundNumber: idx + 1,
      items: lines.length ? lines : null, total: Math.abs(Number(r.amount)),
      reason: r.reason || "Refunded on the old site", customerRefundMethod: "manual", customerRefundAmount: Math.abs(Number(r.amount)),
      wooRefundId: r.id, source: "woocommerce", processedAt: r.date ? new Date(r.date) : new Date(o.created),
    });
  });
  if (!o.refunds && o.refunded > 0) bump("orders with refunds but no refund ids (plugin older than 1.1.0)");

  const created = new Date(o.created);
  const status = STATUS[o.status] ?? "PROCESSING";
  orderRows.push({
    id: orderOid(o.id), orderNumber: String(o.number), physicianId, salesRepId,
    items, subtotal: o.subtotal, total: Number(o.total),
    ...c,
    status, commissionPaid: !anyPending, commissionCreditedAt: creditedAt,
    billingAddress: address(o.billing), shippingAddress: address(o.shipping) ?? address(o.billing),
    shippingRate: Number(o.shipping_total) || 0, shippingMethod: o.shipping_lines[0]?.method ?? null,
    paymentMethod: payment(o.payment),
    paymentStatus: o.status === "failed" ? "FAILED" : o.paid ? "PAID" : "PENDING",
    // Shown only: never stripePaymentIntentId, so no card refund can start from an old order
    transactionId: str(metaOf(o, "_stripe_intent_id")) || str(metaOf(o, "_transaction_id")) || null,
    notes: o.customer_note || null,
    couponCode: o.coupons[0] ?? null, discountAmount: Number(o.discount_total) || 0, taxAmount: Number(o.tax_total) || 0,
    wooOrderId: o.id, wooSyncStatus: "SYNCED", wooSyncAt: created,
    customerEmail: o.billing.email || null, customerPhone: o.billing.phone || null,
    placedBySalesRep: isRep(cust), placedByAdmin: false,
    ...(o.refunded > 0 && {
      returnedTotal: Number(o.refunded), returnedAt: refunds.at(-1)?.date ? new Date(refunds.at(-1)!.date!) : created,
      returnReason: refunds.at(-1)?.reason || "Refunded on the old site",
    }),
    createdAt: created, updatedAt: o.completed ? new Date(o.completed) : created,
  });
  bump(`orders ${status}`);
}

// ── wallets, payout history, money still owed ──

type Tx = { at: Date; amount: number; type: "CREDIT" | "DEBIT"; orderId: string | null; description: string; key: string };
const txByUser = new Map<string, { role: "PHYSICIAN" | "SALES_REP"; txs: Tx[] }>();
const payouts = new Map<string, { userId: string; role: "PHYSICIAN" | "SALES_REP"; at: Date; amount: number; methods: Set<string>; comments: Set<string> }>();
const orderNumberOf = new Map(orders.map((o) => [String(o.id), String(o.number)]));
let owed = 0, paid = 0, skippedPaid = 0;

for (const l of ledger) {
  const uid = Number(l.user_id);
  const pts = Number(l.points) || 0;
  if (pts <= 0 || (l.status !== "payout_done" && l.status !== "approve")) continue;
  if (!kinds.has(uid)) { if (l.status === "payout_done") skippedPaid += pts; continue; }
  const role = isRep(uid) ? "SALES_REP" as const : "PHYSICIAN" as const;
  const userId = role === "SALES_REP" ? repOid(uid) : docOid(uid);
  const entry = txByUser.get(userId) ?? { role, txs: [] };
  const linked = matchedRows.has(l.id);
  entry.txs.push({
    at: siteTime(l.created_on), amount: pts, type: "CREDIT", key: `credit:${l.id}`,
    orderId: linked ? orderOid(Number(l.order_id)) : null,
    description: linked ? `Commission for order #${orderNumberOf.get(l.order_id)}` : `Commission (old site order ${l.order_id}, level ${l.level})`,
  });
  txByUser.set(userId, entry);
  if (l.status === "approve") { owed += pts; continue; }

  paid += pts;
  const at = utcTime(l.payout_on) ?? siteTime(l.created_on);
  const method = l.payout_method || "Payout";
  const key = `${userId}:${at.toISOString().slice(0, 10)}:${method}`;
  const p = payouts.get(key) ?? { userId, role, at, amount: 0, methods: new Set<string>(), comments: new Set<string>() };
  p.amount = r2(p.amount + pts);
  if (at > p.at) p.at = at;
  p.methods.add(method);
  if (l.payout_comment) p.comments.add(l.payout_comment);
  payouts.set(key, p);
}

const payoutRows: Record<string, unknown>[] = [];
for (const [key, p] of payouts) {
  payoutRows.push({
    id: oid("payout", key), userId: p.userId, userRole: p.role, amount: p.amount, status: "APPROVED",
    note: "Commission payout",
    adminNote: `Paid on the old site · ${[...p.methods].join(", ")}${p.comments.size ? ` · ${[...p.comments].join("; ").slice(0, 300)}` : ""}`,
    periodKey: monthKey(p.at), snapshotAt: p.at, notificationStatus: "SENT",
    createdAt: p.at, updatedAt: p.at,
  });
  const entry = txByUser.get(p.userId)!;
  entry.txs.push({ at: p.at, amount: p.amount, type: "DEBIT", orderId: null, description: `Paid Commission (old site · ${[...p.methods].join(", ")})`, key: `debit:${key}` });
}

const walletRows: Record<string, unknown>[] = [];
const balances = new Map<string, number>();
for (const [userId, { role, txs }] of txByUser) {
  let balance = 0;
  for (const t of txs.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.type === "CREDIT" ? -1 : 1))) {
    balance = r2(balance + (t.type === "CREDIT" ? t.amount : -t.amount));
    walletRows.push({
      id: oid("wallet", t.key), userId, userRole: role, amount: t.amount, type: t.type, description: t.description,
      orderId: t.orderId, periodKey: monthKey(t.at), balance, createdAt: t.at,
    });
  }
  balances.set(userId, balance);
}
// What is still owed waits in Commission Payout, like newly approved commission
const now = new Date();
const runningRows: Record<string, unknown>[] = [];
for (const [userId, balance] of balances) {
  if (balance <= 0.004) continue;
  const role = txByUser.get(userId)!.role;
  runningRows.push({
    id: oid("running", userId), userId, userRole: role, amount: r2(balance), status: "PENDING",
    note: "Commission payout", periodKey: monthKey(now), snapshotAt: now,
  });
}
for (const r of [...repRows, ...docRows]) r.walletBalance = r2(Math.max(0, balances.get(r.id as string) ?? 0));

// ── write ──

async function insertNew(model: { findMany: (a: object) => Promise<{ id: string }[]>; createMany: (a: { data: object[] }) => Promise<unknown> }, rows: Record<string, unknown>[], label: string) {
  const have = new Set<string>();
  for (let i = 0; i < rows.length; i += 1000) {
    const ids = rows.slice(i, i + 1000).map((r) => r.id as string);
    for (const r of await model.findMany({ where: { id: { in: ids } }, select: { id: true } })) have.add(r.id);
  }
  const fresh = rows.filter((r) => !have.has(r.id as string));
  if (!dry) for (let i = 0; i < fresh.length; i += 500) await model.createMany({ data: fresh.slice(i, i + 500) });
  console.log(`${label.padEnd(26)} ${String(rows.length).padStart(6)} total, ${String(fresh.length).padStart(6)} new${dry ? " (dry run)" : ""}`);
}

console.log(`Database: ${dbName}${dry ? " (dry run: nothing is written)" : ""}`);
if (wipe) {
  const counts = await Promise.all([
    prisma.order.count(), prisma.partneringPhysician.count(), prisma.salesRepresentative.count(),
    prisma.walletTransaction.count(), prisma.withdrawRequest.count(), prisma.commissionEvent.count(),
  ]);
  console.log(`wipe test data: ${counts[0]} orders, ${counts[1]} doctors, ${counts[2]} reps, ${counts[3]} wallet rows, ${counts[4]} payouts, ${counts[5]} history rows${dry ? " (dry run)" : ""}`);
  if (!dry) {
    await prisma.orderRefund.deleteMany({});
    await prisma.shipment.deleteMany({});
    await prisma.wooLabel.deleteMany({});
    await prisma.commissionEvent.deleteMany({});
    await prisma.walletTransaction.deleteMany({});
    await prisma.withdrawRequest.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.partneringPhysician.deleteMany({});
    await prisma.salesRepresentative.deleteMany({});
    await prisma.counter.deleteMany({ where: { id: "orderNumber" } });
  }
}

await insertNew(prisma.salesRepresentative as never, repRows, "reps");
await insertNew(prisma.partneringPhysician as never, docRows, "doctors");
// A second run with passwords that came later: set them where the placeholder
// still is (checked here: Prisma's startsWith on Mongo doesn't escape "$")
if (!dry) {
  let set = 0;
  const withHash = new Map([...repRows, ...docRows].filter((r) => !String(r.password).startsWith(PLACEHOLDER)).map((r) => [r.id as string, r.password as string]));
  const stillPlaceholder = async (m: { findMany: (a: object) => Promise<{ id: string; password: string }[]> }) =>
    (await m.findMany({ where: { id: { in: [...withHash.keys()] } }, select: { id: true, password: true } }))
      .filter((u) => u.password.startsWith(PLACEHOLDER)).map((u) => u.id);
  for (const id of await stillPlaceholder(prisma.salesRepresentative as never)) {
    await prisma.salesRepresentative.update({ where: { id }, data: { password: withHash.get(id)! } });
    set++;
  }
  for (const id of await stillPlaceholder(prisma.partneringPhysician as never)) {
    await prisma.partneringPhysician.update({ where: { id }, data: { password: withHash.get(id)!, hasCustomPassword: true } });
    set++;
  }
  if (set) console.log(`passwords set on existing accounts: ${set}`);
}
await insertNew(prisma.order as never, orderRows, "orders");
await insertNew(prisma.orderRefund as never, refundRows, "old refunds");
await insertNew(prisma.commissionEvent as never, eventRows, "commission history rows");
await insertNew(prisma.walletTransaction as never, walletRows, "wallet ledger rows");
await insertNew(prisma.withdrawRequest as never, payoutRows, "payouts (history)");
await insertNew(prisma.withdrawRequest as never, runningRows, "payouts still owed");

// New orders are numbered after the old site's last one
const highest = Math.max(...orders.map((o) => Number(o.number) || 0));
if (!dry) {
  const c = await prisma.counter.findUnique({ where: { id: "orderNumber" } });
  if (!c || c.value < highest) await prisma.counter.upsert({ where: { id: "orderNumber" }, create: { id: "orderNumber", value: highest }, update: { value: highest } });
}

console.log("\n== Report");
for (const [k, v] of Object.entries(report).sort()) console.log(`${k}: ${v}`);
console.log(`paid out on the old site (imported users): $${r2(paid)} in ${payoutRows.length} payouts`);
console.log(`paid out to deleted / company / admin accounts (not imported): $${r2(skippedPaid)}`);
console.log(`approved, not paid yet → wallets / Commission Payout: $${r2(owed)} for ${runningRows.length} users`);
console.log(`orders with commission awaiting review (WP box needs review meta on switch day): ${awaitingWooIds.length}`);
console.log(`next new order number: ${highest + 1}`);

// The WP Commissions box of the orders awaiting review (on the copy only)
if (reviewMeta) {
  const wooHost = new URL(process.env.WOO_URL!).hostname;
  if (/(^|\.)login2\.pronuvia\.com$/i.test(wooHost)) {
    console.error(`--woo-review-meta refused: WOO_URL is the live site (${wooHost})`);
  } else {
    const nameOf = new Map([...repRows, ...docRows].map((r) => [r.id as string, `${r.firstName} ${r.lastName}`.trim()]));
    const awaiting = orderRows.filter((o) => o.physicianCommissionReview === "AWAITING" || o.salesRepCommissionReview === "AWAITING");
    for (const o of awaiting) {
      const meta = [
        { key: REVIEW_META_KEY, value: JSON.stringify(reviewMetaFor(o as never)) },
        ...(o.physicianId ? [{ key: NAME_META_KEYS.physician, value: nameOf.get(o.physicianId as string) ?? "" }] : []),
        ...(o.salesRepId ? [{ key: NAME_META_KEYS.sales_rep, value: nameOf.get(o.salesRepId as string) ?? "" }] : []),
      ];
      if (!dry) await updateWooOrder(o.wooOrderId as number, { meta_data: meta });
      console.log(`review meta ${dry ? "(dry run) " : ""}→ Woo #${o.wooOrderId} (${wooHost}): ${meta[0].value}`);
    }
  }
}
if (notes.length) console.log(`\n== Notes (${notes.length})\n` + notes.join("\n"));
await prisma.$disconnect();
