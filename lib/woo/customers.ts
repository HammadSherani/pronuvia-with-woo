import "server-only";
import { randomBytes } from "crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import {
  isEmptyAddress, normalizeAddressString, normalizePhysicianAddress, type NormalizedAddress,
} from "@/lib/addresses/normalize";
import { wooFetch, WooError } from "./client";
import type { WooMeta } from "./types";

// Every Sales Rep and every APPROVED Physician is linked to one WooCommerce
// customer (stored as wooCustomerId). Login stays in Next.js: the Woo customer
// only carries name, email and addresses so orders can be attached to it.
//
// Email clash: WordPress allows one account per email. If a customer with the
// user's email already exists it is linked instead of duplicated. The first
// Pronuvia user to link it becomes its owner (meta pronuvia_user_id); a second
// user sharing that email (e.g. a rep who is also a physician) links to the
// same customer but never overwrites the owner's details.

export type CustomerRole = "SALES_REP" | "PHYSICIAN";

export type CustomerSyncResult = {
  role:           CustomerRole;
  userId:         string;
  email?:         string;
  status:         "created" | "linked" | "updated" | "shared" | "skipped" | "failed";
  wooCustomerId?: number;
  reason?:        string;
};

type WooCustomer = { id: number; email: string; username?: string; role?: string; meta_data: WooMeta[] };

type UserProfile = {
  role:          CustomerRole;
  id:            string;
  email:         string;
  firstName:     string;
  lastName:      string;
  phone:         string;
  billing:       NormalizedAddress | null;
  shipping:      NormalizedAddress | null;
  loginId:       string | null;
  wooCustomerId: number | null;
  eligible:      boolean;
  skipReason?:   string;
};

// No leading underscore: WooCommerce hides "_"-prefixed (protected) customer
// meta from the REST API, so it could never be read back.
const META_ROLE  = "pronuvia_role";
const META_OWNER = "pronuvia_user_id";
// The WP username follows it (plugin wordpress/pronuvia-customers renames the user)
const META_LOGIN = "pronuvia_login_id";

/**
 * The WordPress username for a Login ID: what WP's sanitize_user() keeps
 * (letters, digits, space . _ - @), lowercase. Null when nothing usable is left.
 */
export function wpUsername(loginId: string | null | undefined): string | null {
  const v = (loginId ?? "").trim().toLowerCase().replace(/[^a-z0-9 _.@-]/g, "");
  return v.length >= 3 ? v : null;
}
const fallbackUsername = (role: CustomerRole, id: string) => `pronuvia-${role.toLowerCase().replace("_", "-")}-${id}`;

// ── Load the Pronuvia user ────────────────────────────────────────────────────

async function loadProfile(role: CustomerRole, id: string): Promise<UserProfile | null> {
  if (role === "SALES_REP") {
    const r = await prisma.salesRepresentative.findUnique({
      where:  { id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, loginId: true,
        billingAddress: true, shippingAddress: true, wooCustomerId: true,
      },
    });
    if (!r) return null;
    const billing  = normalizeAddressString(r.billingAddress);
    const shipping = normalizeAddressString(r.shippingAddress);
    return {
      role, id: r.id, email: r.email, firstName: r.firstName, lastName: r.lastName, phone: r.phone ?? "",
      loginId: r.loginId ?? null,
      billing:  isEmptyAddress(billing)  ? (isEmptyAddress(shipping) ? null : shipping) : billing,
      shipping: isEmptyAddress(shipping) ? (isEmptyAddress(billing)  ? null : billing)  : shipping,
      wooCustomerId: r.wooCustomerId ?? null,
      eligible: true,
    };
  }

  const p = await prisma.partneringPhysician.findUnique({
    where:  { id },
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true, isApproved: true,
      addressOne: true, addressTwo: true, city: true, state: true, zipCode: true, country: true,
      nameOfPractice: true, wooCustomerId: true, loginId: true,
    },
  });
  if (!p) return null;
  const address = normalizePhysicianAddress(p);
  return {
    role, id: p.id, email: p.email, firstName: p.firstName, lastName: p.lastName, phone: p.phone ?? "",
    loginId: p.loginId ?? null,
    billing: address, shipping: address,
    wooCustomerId: p.wooCustomerId ?? null,
    eligible:   p.isApproved === ApprovalStatus.APPROVED,
    skipReason: p.isApproved === ApprovalStatus.APPROVED ? undefined : `physician is ${p.isApproved}`,
  };
}

async function saveWooCustomerId(role: CustomerRole, id: string, wooCustomerId: number | null) {
  if (role === "SALES_REP") {
    await prisma.salesRepresentative.update({ where: { id }, data: { wooCustomerId } });
  } else {
    await prisma.partneringPhysician.update({ where: { id }, data: { wooCustomerId } });
  }
}

// ── Woo payloads ──────────────────────────────────────────────────────────────

function wooAddress(a: NormalizedAddress | null, u: UserProfile, withEmail: boolean) {
  return {
    first_name: a?.firstName || u.firstName,
    last_name:  a?.lastName  || u.lastName,
    company:    a?.company   ?? "",
    address_1:  a?.address1  ?? "",
    address_2:  a?.address2  ?? "",
    city:       a?.city      ?? "",
    state:      a?.state     ?? "",
    postcode:   a?.zip       ?? "",
    country:    a?.country   ?? "",
    phone:      a?.phone     || u.phone,
    ...(withEmail && { email: u.email }),
  };
}

function customerBody(u: UserProfile) {
  return {
    email:      u.email,
    first_name: u.firstName,
    last_name:  u.lastName,
    billing:    wooAddress(u.billing, u, true),
    shipping:   wooAddress(u.shipping, u, false),
    meta_data:  [
      { key: META_ROLE,  value: u.role },
      { key: META_OWNER, value: u.id },
      { key: META_LOGIN, value: wpUsername(u.loginId) ?? "" },
    ],
  };
}

const ownerOf = (c: WooCustomer) => c.meta_data.find((m) => m.key === META_OWNER)?.value as string | undefined;

/**
 * The Pronuvia user a customer belongs to, if that user still exists. A
 * customer left by a deleted rep / doctor is free: the next user with its
 * email takes it over.
 */
async function liveOwner(c: WooCustomer): Promise<string | undefined> {
  const owner = ownerOf(c);
  if (!owner || !/^[a-f0-9]{24}$/i.test(owner)) return owner;
  const [rep, doc] = await Promise.all([
    prisma.salesRepresentative.findUnique({ where: { id: owner }, select: { id: true } }),
    prisma.partneringPhysician.findUnique({ where: { id: owner }, select: { id: true } }),
  ]);
  return rep || doc ? owner : undefined;
}

async function findCustomerByEmail(email: string): Promise<WooCustomer | null> {
  // role=all also finds WordPress users that aren't "customer" (e.g. an admin)
  const { data } = await wooFetch<WooCustomer[]>("wc/v3/customers", { query: { email, role: "all" } });
  return data.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function getCustomer(id: number): Promise<WooCustomer | null> {
  try {
    const { data } = await wooFetch<WooCustomer>(`wc/v3/customers/${id}`);
    return data;
  } catch (e) {
    if (e instanceof WooError && (e.status === 404 || e.code === "woocommerce_rest_invalid_id")) return null;
    throw e;
  }
}

const errorText = (e: unknown) =>
  e instanceof WooError ? `${e.message} (${e.code})` : e instanceof Error ? e.message : String(e);

/**
 * Registration check: a WP account with this email that no current Pronuvia
 * user has (left by a deleted rep / doctor, or made in WP itself) blocks a
 * new rep / doctor with the same email. An account a current Pronuvia user
 * has (e.g. the same person as rep and doctor) does not. WooCommerce not
 * answering does not block registration either (logged).
 */
export async function wooEmailTaken(email: string): Promise<{ id: number; username: string } | null> {
  try {
    const c = await findCustomerByEmail(email.trim().toLowerCase());
    if (!c) return null;
    if (await liveOwner(c)) return null;
    const [rep, doc] = await Promise.all([
      prisma.salesRepresentative.findFirst({ where: { wooCustomerId: c.id }, select: { id: true } }),
      prisma.partneringPhysician.findFirst({ where: { wooCustomerId: c.id }, select: { id: true } }),
    ]);
    if (rep || doc) return null;
    return { id: c.id, username: c.username ?? "" };
  } catch (e) {
    console.error("[woo-customer] email check failed, registration allowed:", e);
    return null;
  }
}

/** The error shown for an email taken in WP: plain for users, with details for admins. */
export function wooEmailTakenMessage(t: { id: number; username: string }, forAdmin: boolean): string {
  return forAdmin
    ? `This email already has a WordPress account (#${t.id}${t.username ? `, username ${t.username}` : ""}). Delete it in WP admin (Users) or use another email.`
    : "This email is already registered. Please use another email or contact Pronuvia support.";
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Creates, links or updates the Woo customer for one user. Never throws: Woo
 * being down must not break creating or editing a user — the link is retried
 * by the next sync, the backfill, or getOrCreateWooCustomer at checkout.
 */
export async function syncWooCustomer(
  role: CustomerRole, userId: string, opts: { dryRun?: boolean } = {},
): Promise<CustomerSyncResult> {
  const base = { role, userId };
  let u: UserProfile | null;
  try {
    u = await loadProfile(role, userId);
  } catch (e) {
    return { ...base, status: "failed", reason: `could not load user: ${errorText(e)}` };
  }
  if (!u) return { ...base, status: "skipped", reason: "user not found" };
  const res = { ...base, email: u.email };
  if (!u.eligible) return { ...res, status: "skipped", reason: u.skipReason };

  try {
    // Already linked: refresh the customer if this user owns it
    if (u.wooCustomerId) {
      const current = await getCustomer(u.wooCustomerId);
      if (current) {
        const owner = await liveOwner(current);
        if (owner && owner !== u.id) {
          return { ...res, status: "shared", wooCustomerId: current.id, reason: "customer owned by another Pronuvia user" };
        }
        if (!opts.dryRun) {
          await wooFetch(`wc/v3/customers/${current.id}`, { method: "PUT", body: customerBody(u) });
        }
        return { ...res, status: "updated", wooCustomerId: current.id };
      }
      // Customer was deleted in WordPress — fall through and link/create again
    }

    const existing = await findCustomerByEmail(u.email);
    if (existing) {
      const owner = await liveOwner(existing);
      if (!opts.dryRun) {
        if (!owner) {
          // Unclaimed account with this email: claim it and fill in our details
          await wooFetch(`wc/v3/customers/${existing.id}`, { method: "PUT", body: customerBody(u) });
        }
        await saveWooCustomerId(role, u.id, existing.id);
      }
      return {
        ...res,
        status: owner && owner !== u.id ? "shared" : "linked",
        wooCustomerId: existing.id,
        reason: owner && owner !== u.id ? "email already belongs to another Pronuvia user's customer" : undefined,
      };
    }

    if (opts.dryRun) return { ...res, status: "created", reason: "would create" };

    // The username is the Login ID (never used to log in — Pronuvia login
    // stays in Next.js); taken in WP or no Login ID → pronuvia-<role>-<id>
    const create = (username: string) => wooFetch<WooCustomer>("wc/v3/customers", {
      method: "POST",
      body: { ...customerBody(u), username, password: randomBytes(24).toString("base64url") },
    });
    try {
      const wanted = wpUsername(u.loginId);
      let created: WooCustomer;
      try {
        created = (await create(wanted ?? fallbackUsername(role, u.id))).data;
      } catch (e) {
        if (!(wanted && e instanceof WooError && e.code === "registration-error-username-exists")) throw e;
        created = (await create(fallbackUsername(role, u.id))).data;
      }
      await saveWooCustomerId(role, u.id, created.id);
      return { ...res, status: "created", wooCustomerId: created.id };
    } catch (e) {
      // Lost a race with another request creating the same email: link it
      if (e instanceof WooError && e.code === "registration-error-email-exists") {
        const raced = await findCustomerByEmail(u.email);
        if (raced) {
          await saveWooCustomerId(role, u.id, raced.id);
          return { ...res, status: "linked", wooCustomerId: raced.id };
        }
      }
      throw e;
    }
  } catch (e) {
    return { ...res, status: "failed", reason: errorText(e) };
  }
}

function logResult(r: CustomerSyncResult) {
  const line = `[woo-customer] ${r.role} ${r.userId} ${r.status}${r.wooCustomerId ? ` #${r.wooCustomerId}` : ""}${r.reason ? ` — ${r.reason}` : ""}`;
  if (r.status === "failed") console.error(line);
  else console.log(line);
}

/** Runs the sync after the response is sent, so saving a user never waits on Woo. */
export function scheduleWooCustomerSync(role: CustomerRole, userId: string) {
  after(async () => logResult(await syncWooCustomer(role, userId)));
}

/** The user's Woo customer id, creating/linking it now if needed (null if Woo fails). */
export async function getOrCreateWooCustomer(role: CustomerRole, userId: string): Promise<number | null> {
  const current = role === "SALES_REP"
    ? await prisma.salesRepresentative.findUnique({ where: { id: userId }, select: { wooCustomerId: true } })
    : await prisma.partneringPhysician.findUnique({ where: { id: userId }, select: { wooCustomerId: true } });
  if (current?.wooCustomerId) return current.wooCustomerId;
  const result = await syncWooCustomer(role, userId);
  logResult(result);
  return result.wooCustomerId ?? null;
}

/** Backfill: link every sales rep and approved physician. Safe to run repeatedly. */
export async function syncAllWooCustomers(opts: { dryRun?: boolean } = {}) {
  const [reps, physicians] = await Promise.all([
    prisma.salesRepresentative.findMany({ select: { id: true } }),
    prisma.partneringPhysician.findMany({ where: { isApproved: ApprovalStatus.APPROVED }, select: { id: true } }),
  ]);
  const results: CustomerSyncResult[] = [];
  // Sequential on purpose: two users with the same email must not race
  for (const r of reps)       results.push(await syncWooCustomer("SALES_REP", r.id, opts));
  for (const p of physicians) results.push(await syncWooCustomer("PHYSICIAN", p.id, opts));

  const totals: Record<string, number> = {};
  for (const r of results) totals[r.status] = (totals[r.status] ?? 0) + 1;
  return { dryRun: !!opts.dryRun, totals, results };
}
