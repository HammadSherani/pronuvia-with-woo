import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CommissionReview } from "@/generated/prisma/enums";

// Commission review: each order's commission (doctor, sales rep) is approved,
// rejected or modified by the admin on the WP order page (plugin
// wordpress/pronuvia-commissions). The decision lives in the Woo order meta
// `pronuvia_commission_review` and comes back here when the order is brought
// up to date (webhook, cron, opening it). Only approved commission is paid.

export const REVIEW_META_KEY = "pronuvia_commission_review";
export const PAID_META_KEY   = "pronuvia_commission_paid";
export const NAME_META_KEYS  = { physician: "pronuvia_physician_name", sales_rep: "pronuvia_sales_rep_name" } as const;

type Role = "physician" | "sales_rep";
type WooStatus = "pending" | "approved" | "rejected";

export type ReviewEntry = {
  status:   WooStatus;
  amount:   number;   // the commission to pay
  original: number;   // the commission the order earned
  note?:    string;
  at?:      string;
  by?:      string;
  // Commission the admin took back after it was paid ("Refund commission")
  refunds?: { id: string; amount: number; note?: string; at?: string; by?: string }[];
};
export type ReviewMeta = Partial<Record<Role, ReviewEntry>>;

const FIELDS = {
  physician: { review: "physicianCommissionReview", amount: "physicianCommissionAmount", original: "physicianCommissionOriginal", note: "physician" },
  sales_rep: { review: "salesRepCommissionReview",  amount: "salesRepCommissionAmount",  original: "salesRepCommissionOriginal",  note: "salesRep" },
} as const;

const toWoo = (r: CommissionReview | null | undefined): WooStatus =>
  r === CommissionReview.AWAITING ? "pending" : r === CommissionReview.REJECTED ? "rejected" : "approved";

/** Is this role's commission payable: approved (null = approved, older orders). */
export const isApproved = (r: CommissionReview | null | undefined) => r !== CommissionReview.AWAITING && r !== CommissionReview.REJECTED;

/**
 * Paid into the wallet through the WP review: from then on its commission is
 * only taken back by the admin's "Refund commission" on the WP order page,
 * never automatically by an order refund or cancellation.
 */
export const reviewManaged = (o: {
  commissionPaid: boolean;
  physicianCommissionReview?: CommissionReview | null; salesRepCommissionReview?: CommissionReview | null;
}) => o.commissionPaid && (o.physicianCommissionReview != null || o.salesRepCommissionReview != null);

/** Meta sent with the order to Woo: what the WP Commissions box starts from. */
export function reviewMetaFor(order: {
  physicianCommissionAmount: number; salesRepCommissionAmount: number;
  physicianCommissionReview?: CommissionReview | null; salesRepCommissionReview?: CommissionReview | null;
  physicianCommissionOriginal?: number | null; salesRepCommissionOriginal?: number | null;
}): ReviewMeta {
  const meta: ReviewMeta = {};
  if (order.physicianCommissionAmount > 0 || order.physicianCommissionOriginal) {
    meta.physician = { status: toWoo(order.physicianCommissionReview), amount: order.physicianCommissionAmount, original: order.physicianCommissionOriginal ?? order.physicianCommissionAmount };
  }
  if (order.salesRepCommissionAmount > 0 || order.salesRepCommissionOriginal) {
    meta.sales_rep = { status: toWoo(order.salesRepCommissionReview), amount: order.salesRepCommissionAmount, original: order.salesRepCommissionOriginal ?? order.salesRepCommissionAmount };
  }
  return meta;
}

function parse(raw: unknown): ReviewMeta | null {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  if (!v || typeof v !== "object") return null;
  const out: ReviewMeta = {};
  for (const role of ["physician", "sales_rep"] as const) {
    const e = (v as Record<string, unknown>)[role] as Record<string, unknown> | undefined;
    if (!e || typeof e !== "object") continue;
    const status = e.status;
    const amount = Number(e.amount);
    if (status !== "pending" && status !== "approved" && status !== "rejected") continue;
    if (!Number.isFinite(amount) || amount < 0) continue;
    out[role] = {
      status, amount: Math.round(amount * 100) / 100,
      original: Number(e.original) || 0,
      note: typeof e.note === "string" ? e.note.slice(0, 500) : undefined,
      at:   typeof e.at === "string" ? e.at : undefined,
      by:   typeof e.by === "string" ? e.by.slice(0, 120) : undefined,
      refunds: Array.isArray(e.refunds)
        ? (e.refunds as Record<string, unknown>[]).flatMap((r) => {
            const amt = Number(r?.amount);
            return typeof r?.id === "string" && r.id && Number.isFinite(amt) && amt > 0
              ? [{ id: r.id.slice(0, 80), amount: Math.round(amt * 100) / 100,
                   note: typeof r.note === "string" ? r.note.slice(0, 500) : undefined,
                   at: typeof r.at === "string" ? r.at : undefined, by: typeof r.by === "string" ? r.by.slice(0, 120) : undefined }]
              : [];
          })
        : undefined,
    };
  }
  return out;
}

/**
 * Applies the review found on the Woo order. A commission already paid out
 * is never changed; "pending" never undoes a decision.
 */
export function parseReviewMeta(raw: unknown): ReviewMeta | null {
  return parse(raw);
}

export async function applyCommissionReview(orderId: string, raw: unknown): Promise<boolean> {
  const meta = parse(raw);
  if (!meta) return false;
  const order = await prisma.order.findUniqueOrThrow({
    where:  { id: orderId },
    select: {
      commissionPaid: true, subtotal: true, total: true, commissionReviewNotes: true,
      physicianCommissionReview: true, physicianCommissionAmount: true, physicianCommissionOriginal: true,
      salesRepCommissionReview: true, salesRepCommissionAmount: true, salesRepCommissionOriginal: true,
    },
  });
  if (order.commissionPaid) return false;

  const data: Record<string, unknown> = {};
  const notes = { ...((order.commissionReviewNotes as Record<string, unknown> | null) ?? {}) };
  for (const role of ["physician", "sales_rep"] as const) {
    const e = meta[role];
    if (!e || e.status === "pending") continue;
    const f = FIELDS[role];
    const review   = order[f.review] as CommissionReview | null;
    const current  = order[f.amount] as number;
    const original = (order[f.original] as number | null) ?? current;
    const next     = e.status === "approved" ? CommissionReview.APPROVED : CommissionReview.REJECTED;
    // Approved with another amount = modified; never more than the order's items
    const amount = e.status === "approved" ? Math.min(e.amount, order.subtotal > 0 ? order.subtotal : order.total) : current;
    // No review yet (an older order) counts as approved: Woo's "approved"
    // for it is no decision and must not make it look freshly approved
    if ((review ?? CommissionReview.APPROVED) === next && amount === current) continue;

    data[f.review] = next;
    if (amount !== current) {
      data[f.original] = original;
      data[f.amount]   = amount;
    }
    notes[f.note] = { status: e.status, amount, original, note: e.note ?? null, at: e.at ?? new Date().toISOString(), by: e.by ?? null };
  }
  if (!Object.keys(data).length) return false;
  data.commissionReviewNotes = notes;
  await prisma.order.update({ where: { id: orderId }, data });
  return true;
}
