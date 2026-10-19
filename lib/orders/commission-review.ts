import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CommissionReview } from "@/generated/prisma/enums";
import { addWooOrderNote, updateWooOrder } from "@/lib/woo/orders";
import { upsertRunningPayoutRequest } from "@/lib/withdrawals/running-request";
import { moveWalletForOrder } from "@/lib/withdrawals/wallet-move";
import { recordCommissionEvent } from "./commission-history";

// Commission review: each order's commission (doctor, sales rep) is approved,
// rejected or modified by the admin on the WP order page (plugin
// wordpress/pronuvia-commissions). The decision lives in the Woo order meta
// `pronuvia_commission_review` and comes back here when the order is brought
// up to date (webhook, cron, opening it). Only approved commission is paid.
//
// Stages of a role's commission:
//   - awaiting review: nothing in the wallet yet;
//   - in payout (order commissionPaid): in the wallet and the pending payout
//     request; the admin can still approve / reject / modify on WP, and the
//     wallet moves by the difference;
//   - paid out (*CommissionPaidOutAt, set when the user's payout is approved
//     in Commission Payout): fixed; only "Refund commission" takes part back.

export const REVIEW_META_KEY   = "pronuvia_commission_review";
export const PAID_META_KEY     = "pronuvia_commission_paid";       // "yes" once in payout
export const PAID_OUT_META_KEY = "pronuvia_commission_paid_out";   // JSON list of paid-out roles
export const CUTS_META_KEY     = "pronuvia_commission_cuts";       // JSON { physician, sales_rep }: cut by order refunds
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
  // Every review action, written by the plugin (1.4.0+)
  history?: { id: string; action: "approved" | "rejected" | "modified"; amount: number; prev?: number; note?: string; at?: string; by?: string }[];
};
export type ReviewMeta = Partial<Record<Role, ReviewEntry>>;

const FIELDS = {
  physician: { review: "physicianCommissionReview", amount: "physicianCommissionAmount", original: "physicianCommissionOriginal", note: "physician",
               user: "physicianId", clawback: "physicianClawback", paidOut: "physicianCommissionPaidOutAt", role: "PHYSICIAN", label: "Doctor" },
  sales_rep: { review: "salesRepCommissionReview",  amount: "salesRepCommissionAmount",  original: "salesRepCommissionOriginal",  note: "salesRep",
               user: "salesRepId", clawback: "salesRepClawback", paidOut: "salesRepCommissionPaidOutAt", role: "SALES_REP", label: "Sales rep" },
} as const;

const toWoo = (r: CommissionReview | null | undefined): WooStatus =>
  r === CommissionReview.AWAITING ? "pending" : r === CommissionReview.REJECTED ? "rejected" : "approved";

/** Is this role's commission payable: approved (null = approved, older orders). */
export const isApproved = (r: CommissionReview | null | undefined) => r !== CommissionReview.AWAITING && r !== CommissionReview.REJECTED;

/** What a role's commission puts in the wallet: approved → commission less clawback, else nothing. */
export function commissionNet(review: CommissionReview | null | undefined, amount: number, clawback: number | null | undefined): number {
  return isApproved(review) ? Number(Math.max(0, amount - (clawback ?? 0)).toFixed(2)) : 0;
}

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
      history: Array.isArray(e.history)
        ? (e.history as Record<string, unknown>[]).flatMap((h) => {
            const amt = Number(h?.amount), prev = Number(h?.prev);
            const action = h?.action;
            return typeof h?.id === "string" && h.id && (action === "approved" || action === "rejected" || action === "modified") && Number.isFinite(amt) && amt >= 0
              ? [{ id: h.id.slice(0, 80), action, amount: Math.round(amt * 100) / 100,
                   prev: Number.isFinite(prev) && h?.prev !== undefined && h?.prev !== null ? Math.round(prev * 100) / 100 : undefined,
                   note: typeof h.note === "string" ? h.note.slice(0, 500) : undefined,
                   at: typeof h.at === "string" ? h.at : undefined, by: typeof h.by === "string" ? h.by.slice(0, 120) : undefined }]
              : [];
          })
        : undefined,
    };
  }
  return out;
}

export function parseReviewMeta(raw: unknown): ReviewMeta | null {
  return parse(raw);
}

/**
 * Applies the review found on the Woo order, role by role:
 *   - awaiting review / in payout: the decision is taken; in payout the
 *     wallet and pending payout request move by the difference (may go
 *     below zero);
 *   - paid out: the change is not taken, and the Woo meta is put back to
 *     what was paid so the WP box shows it.
 * Modify on WP changes only the amount, whatever the status: a pending or
 * rejected commission keeps it for when it is approved. "pending" never
 * undoes a decision.
 */
export async function applyCommissionReview(orderId: string, raw: unknown): Promise<boolean> {
  const meta = parse(raw);
  if (!meta) return false;
  const order = await prisma.order.findUniqueOrThrow({
    where:  { id: orderId },
    select: {
      orderNumber: true, wooOrderId: true, commissionPaid: true, subtotal: true, total: true, commissionReviewNotes: true,
      physicianId: true, physicianCommissionReview: true, physicianCommissionAmount: true, physicianCommissionOriginal: true,
      physicianClawback: true, physicianCommissionPaidOutAt: true,
      salesRepId: true, salesRepCommissionReview: true, salesRepCommissionAmount: true, salesRepCommissionOriginal: true,
      salesRepClawback: true, salesRepCommissionPaidOutAt: true,
    },
  });

  let changed = false;
  const notPaidAgain: Role[] = [];
  for (const role of ["physician", "sales_rep"] as const) {
    const e = meta[role];
    if (!e) continue;
    const f = FIELDS[role];

    // The plugin's history: every action, also ones made between two refreshes.
    // Actions after the payout were not applied, so they are left out.
    const paidOutAt = order[f.paidOut] as Date | null;
    const written: string[] = [];
    for (const h of e.history ?? []) {
      const at = h.at && !Number.isNaN(Date.parse(h.at)) ? new Date(h.at) : new Date();
      if (paidOutAt && at > paidOutAt) continue;
      const ev = await recordCommissionEvent({
        key: `wp:${orderId}:${role}:${h.id}`, orderId, userRole: f.role,
        action: h.action === "approved" ? "APPROVED" : h.action === "rejected" ? "REJECTED" : "MODIFIED",
        amount: h.amount, previousAmount: h.action === "modified" ? h.prev ?? null : null,
        note: h.note, by: h.by, createdAt: at,
      });
      if (ev) written.push(ev.id);
    }

    const review   = order[f.review] as CommissionReview | null;
    // "pending" never undoes a decision; while awaiting it can still carry a modified amount
    if (e.status === "pending" && review !== CommissionReview.AWAITING) continue;
    const current  = order[f.amount] as number;
    const original = (order[f.original] as number | null) ?? current;
    const next     = e.status === "approved" ? CommissionReview.APPROVED
                   : e.status === "rejected" ? CommissionReview.REJECTED : CommissionReview.AWAITING;
    // Modify changes only the amount (any status); never more than the order's items
    const amount = Math.min(e.amount, order.subtotal > 0 ? order.subtotal : order.total);
    // No review yet (an older order) counts as approved: Woo's "approved"
    // for it is no decision and must not make it look freshly approved
    if ((review ?? CommissionReview.APPROVED) === next && amount === current) continue;

    if (order[f.paidOut]) { notPaidAgain.push(role); continue; }

    const notes = { ...((order.commissionReviewNotes as Record<string, unknown> | null) ?? {}) };
    notes[f.note] = { status: e.status, amount, original, note: e.note ?? null, at: e.at ?? new Date().toISOString(), by: e.by ?? null };
    // Only from the state read above: a second refresh at the same time
    // (webhook + page view) changes nothing, so the wallet moves once
    const claimed = await prisma.order.updateMany({
      where: {
        id: orderId,
        [f.amount]: current,
        AND: [
          review == null ? { OR: [{ [f.review]: null }, { [f.review]: { isSet: false } }] } : { [f.review]: review },
          { OR: [{ [f.paidOut]: null }, { [f.paidOut]: { isSet: false } }] },
        ],
      },
      data: {
        [f.review]: next,
        ...(amount !== current && { [f.original]: original, [f.amount]: amount }),
        commissionReviewNotes: notes as object,
      },
    });
    if (claimed.count !== 1) continue;
    order.commissionReviewNotes = notes as typeof order.commissionReviewNotes;
    changed = true;

    // In payout: the wallet follows the new decision
    const userId = order[f.user];
    const clawback = order[f.clawback] as number | null;
    const delta = order.commissionPaid && userId
      ? Number((commissionNet(next, amount, clawback) - commissionNet(review, current, clawback)).toFixed(2))
      : 0;
    if (delta !== 0 && userId) {
      const what = e.status === "rejected" ? "rejected" : amount !== current ? `changed to $${amount.toFixed(2)}` : "approved";
      await moveWalletForOrder({
        role: f.role, userId, orderId, delta,
        description: `Commission adjusted — order #${order.orderNumber} (${what}${e.note ? `: ${e.note}` : ""})`,
      });
      await upsertRunningPayoutRequest(userId, f.role);
    }

    // History: the wallet change goes on the newest action; an older plugin
    // without history gets one row for the change seen here
    if (e.history?.length) {
      // (a refresh running at the same time may have written the rows)
      const newest = written.length
        ? written[written.length - 1]
        : (await prisma.commissionEvent.findFirst({
            where: { orderId, userRole: f.role, key: { startsWith: `wp:${orderId}:${role}:` } },
            orderBy: { createdAt: "desc" }, select: { id: true },
          }))?.id;
      if (delta !== 0 && newest) await prisma.commissionEvent.update({ where: { id: newest }, data: { walletChange: delta } });
    } else {
      const statusChanged = (review ?? CommissionReview.APPROVED) !== next;
      await recordCommissionEvent({
        orderId, userRole: f.role,
        action: !statusChanged ? "MODIFIED" : next === CommissionReview.APPROVED ? "APPROVED" : next === CommissionReview.REJECTED ? "REJECTED" : "PENDING",
        amount, previousAmount: amount !== current ? current : null, walletChange: delta || null,
        note: e.note, by: e.by, createdAt: e.at && !Number.isNaN(Date.parse(e.at)) ? new Date(e.at) : undefined,
      });
    }
  }

  if (notPaidAgain.length && order.wooOrderId) await restorePaidOutReview(order, raw, notPaidAgain);
  return changed;
}

/** Puts the Woo review of paid-out roles back to what was paid, with an order note. */
async function restorePaidOutReview(
  order: { wooOrderId: number | null } & Record<string, unknown>,
  raw: unknown,
  roles: Role[],
): Promise<void> {
  try {
    let obj: Record<string, Record<string, unknown>> = {};
    try { obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as typeof obj ?? {}; } catch { /* rebuilt below */ }
    for (const role of roles) {
      const f = FIELDS[role];
      obj[role] = { ...(obj[role] ?? {}), status: toWoo(order[f.review] as CommissionReview | null), amount: order[f.amount] as number };
    }
    await updateWooOrder(order.wooOrderId!, { meta_data: [{ key: REVIEW_META_KEY, value: JSON.stringify(obj) }] });
    await addWooOrderNote(order.wooOrderId!,
      `${roles.map((r) => FIELDS[r].label).join(" and ")} commission is already paid out, so the change was not applied. Use Refund commission to take part of it back.`, false);
  } catch (e) {
    console.error(`[commission-review] could not restore the review of Woo order #${order.wooOrderId}:`, e);
  }
}
