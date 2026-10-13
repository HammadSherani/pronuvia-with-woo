import "server-only";
import { Country, State } from "country-state-city";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { reverseOrderCommissionIfPaid } from "@/lib/withdrawals/commission-sweep";
import {
  addWooOrderNote, getWooOrder, updateWooOrder, type WooOrderAddress, type WooOrderDetail,
} from "@/lib/woo/orders";
import { fromWooStatus, STATUS_META_KEY, toWooStatus } from "./woo-status";

// Orders live in WooCommerce; our Order record is the index the order lists,
// permissions and commissions run on. Every change made here goes to Woo
// first and is mirrored only once Woo accepted it. Viewing an order pulls
// what was changed in WP admin (status, addresses, patient contact) back in.

export const META = {
  customerEmail:  "pronuvia_customer_email",
  customerPhone:  "pronuvia_customer_phone",
  trackingNumber: "pronuvia_tracking_number",
  carrier:        "pronuvia_shipping_carrier",
} as const;

// ── addresses: our JSON (AddressData) ⇄ Woo ──

type AddressJson = {
  firstName: string; lastName: string; phone: string; address1: string; address2: string;
  city: string; state: string; stateName: string; zip: string; country: string; countryName: string;
};

export function toWooAddress(raw: string | null | undefined): WooOrderAddress | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw) as Partial<AddressJson>;
    return {
      first_name: a.firstName ?? "", last_name: a.lastName ?? "",
      address_1:  a.address1  ?? "", address_2: a.address2 ?? "",
      city:       a.city      ?? "", state:     a.state    ?? "",
      postcode:   a.zip       ?? "", country:   a.country  ?? "",
      phone:      a.phone     ?? "",
    };
  } catch {
    return null;
  }
}

function fromWooAddress(w: WooOrderAddress): AddressJson {
  // Woo prefixes some state codes ("DE-BE"); our form uses the bare code
  const state = w.state.startsWith(`${w.country}-`) ? w.state.slice(w.country.length + 1) : w.state;
  return {
    firstName: w.first_name, lastName: w.last_name, phone: w.phone ?? "",
    address1:  w.address_1,  address2: w.address_2,
    city:      w.city, state,
    stateName: State.getStateByCodeAndCountry(state, w.country)?.name ?? state,
    zip:       w.postcode, country: w.country,
    countryName: Country.getCountryByCode(w.country)?.name ?? w.country,
  };
}

const sameAddress = (raw: string | null, w: WooOrderAddress) => {
  const ours = toWooAddress(raw);
  if (!ours) return !w.address_1 && !w.city;
  return (Object.keys(ours) as (keyof WooOrderAddress)[]).every((k) => (ours[k] ?? "") === (w[k] ?? ""));
};

const metaValue = (w: WooOrderDetail, key: string) => w.meta_data.find((m) => m.key === key)?.value;

// ── writes ──

export type WooChanges = {
  status?:   OrderStatus;
  shipping?: string;                         // our address JSON
  billing?:  string;
  meta?:     Record<string, string | null>;
  note?:     string;                         // private order note
};

/**
 * Applies changes to the order's Woo order. Orders without one (before Phase
 * 6, or not sent yet) have nothing to update; a pending send carries the
 * current state when it runs. Throws when Woo refuses, so nothing is mirrored.
 */
export async function pushOrderToWoo(orderId: string, changes: WooChanges): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { wooOrderId: true } });
  if (!order?.wooOrderId) return;

  const meta = Object.entries({
    ...(changes.status && { [STATUS_META_KEY]: changes.status }),
    ...changes.meta,
  }).map(([key, value]) => ({ key, value: value ?? "" }));

  const shipping = changes.shipping !== undefined ? toWooAddress(changes.shipping) : null;
  const billing  = changes.billing  !== undefined ? toWooAddress(changes.billing)  : null;

  await updateWooOrder(order.wooOrderId, {
    ...(changes.status && { status: toWooStatus(changes.status) }),
    ...(shipping && { shipping }),
    ...(billing  && { billing }),
    ...(meta.length && { meta_data: meta }),
  });
  if (changes.note) await addWooOrderNote(order.wooOrderId, changes.note, false);
}

/**
 * Our side of a status change: the status, and when a cancelled or refunded
 * order's commission was already paid out, its reversal.
 */
export async function applyStatusLocally(orderId: string, status: OrderStatus): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where:  { id: orderId },
    select: {
      id: true, status: true, orderNumber: true,
      salesRepId: true, physicianId: true,
      salesRepCommissionAmount: true, physicianCommissionAmount: true,
      salesRepClawback: true, physicianClawback: true,
      commissionPaid: true, returnedAt: true, returnReason: true,
    },
  });

  // Commission is credited by the monthly sweep, which skips cancelled and
  // refunded orders. One already swept and now cancelled / refunded is
  // reversed here (a no-op otherwise), same math as the Refund flow.
  const reversal = (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED)
    ? await reverseOrderCommissionIfPaid(order, status)
    : { reversed: false, newSalesRepClawback: order.salesRepClawback, newPhysicianClawback: order.physicianClawback };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(reversal.reversed && {
        commissionPaid:    false,
        salesRepClawback:  reversal.newSalesRepClawback,
        physicianClawback: reversal.newPhysicianClawback,
        returnedAt:        order.returnedAt ?? new Date(),
        returnReason:      order.returnReason ?? `Order ${status === OrderStatus.CANCELLED ? "cancelled" : "refunded"} after commission was paid`,
      }),
    },
  });
}

// ── reads ──

/**
 * Brings an order up to date with its Woo order before it is shown. Woo being
 * unreachable is not an error here: the page shows what we have.
 */
export async function refreshOrderFromWoo(where: { id: string } | { orderNumber: string }): Promise<void> {
  try {
    await refresh(where);
  } catch (e) {
    console.error("[order-woo] refresh from WooCommerce failed:", e);
  }
}

async function refresh(where: { id: string } | { orderNumber: string }): Promise<void> {
  const order = await prisma.order.findUnique({
    where,
    select: {
      id: true, status: true, wooOrderId: true, shippingAddress: true, billingAddress: true,
      customerEmail: true, customerPhone: true, updatedAt: true,
    },
  });
  if (!order?.wooOrderId) return;

  let w: WooOrderDetail;
  try {
    w = await getWooOrder(order.wooOrderId);
  } catch (e) {
    console.error(`[order-woo] could not load Woo order #${order.wooOrderId}:`, e);
    return;
  }
  if (w.status === "trash") return;

  // The statuses disagree: either it was changed in WP admin, or one of our
  // changes could not reach Woo (a refund or label is never undone for that).
  // The later change wins; ours is sent to Woo again.
  if (toWooStatus(order.status) !== w.status) {
    if (new Date(`${w.date_modified_gmt}Z`) > order.updatedAt) {
      await applyStatusLocally(order.id, fromWooStatus(w.status, metaValue(w, STATUS_META_KEY)));
    } else {
      await pushOrderToWoo(order.id, { status: order.status }).catch((e) =>
        console.error(`[order-woo] could not resend status of Woo order #${order.wooOrderId}:`, e));
    }
  }

  const email = metaValue(w, META.customerEmail);
  const phone = metaValue(w, META.customerPhone);
  const data = {
    ...(!sameAddress(order.shippingAddress, w.shipping) && { shippingAddress: JSON.stringify(fromWooAddress(w.shipping)) }),
    ...(!sameAddress(order.billingAddress, w.billing)   && { billingAddress:  JSON.stringify(fromWooAddress(w.billing)) }),
    ...(typeof email === "string" && email !== (order.customerEmail ?? "") && { customerEmail: email || null }),
    ...(typeof phone === "string" && phone !== (order.customerPhone ?? "") && { customerPhone: phone || null }),
  };
  if (Object.keys(data).length) await prisma.order.update({ where: { id: order.id }, data });
}
