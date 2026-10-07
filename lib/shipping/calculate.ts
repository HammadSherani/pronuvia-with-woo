"use server";

import { prisma } from "@/lib/db/prisma";
import { Country } from "country-state-city";
import { ShippingMethod } from "@/generated/prisma/enums";

export type ShippingOption = {
  id:     string;
  method: ShippingMethod;
  label:  string;
  cost:   number;
  scope:  "state" | "country"; // for sorting priority
};

function methodLabel(method: ShippingMethod, countryCode: string): string {
  if (method === ShippingMethod.FLAT) {
    const countryName = Country.getCountryByCode(countryCode)?.name ?? countryCode;
    return `Shipping ${countryName} Flat Rate`;
  }
  if (method === ShippingMethod.FREE)         return "Free Shipping";
  if (method === ShippingMethod.LOCAL_PICKUP) return "Local Pickup";
  if (method === ShippingMethod.FEDEX_2DAY)   return "FedEx 2Day Shipping";
  return method;
}

/**
 * Returns all active shipping options applicable to the given country + state.
 *
 * Priority:
 *   1. State-specific rules (states[] contains stateCode) — shown first
 *   2. Country-wide rules  (states[] is empty)            — shown as fallback
 *
 * If there are state-specific rules the country-wide rules are still included
 * so the admin/customer can see all available options.
 */
export async function getShippingOptionsForCountry(
  countryCode: string,
  stateCode?: string,
): Promise<ShippingOption[]> {
  if (!countryCode) return [];

  const allRates = await prisma.shippingRate.findMany({
    where:   { country: countryCode, isActive: true },
    orderBy: { cost: "asc" },
    select:  { id: true, method: true, cost: true, states: true },
  });

  const stateSpecific: ShippingOption[] = [];
  const countryWide:   ShippingOption[] = [];

  for (const r of allRates) {
    if (r.states.length === 0) {
      // Country-wide rule
      countryWide.push({ id: r.id, method: r.method, label: methodLabel(r.method, countryCode), cost: r.cost, scope: "country" });
    } else if (stateCode && r.states.includes(stateCode)) {
      // State-specific rule that matches the customer's state
      stateSpecific.push({ id: r.id, method: r.method, label: methodLabel(r.method, countryCode), cost: r.cost, scope: "state" });
    }
  }

  // State-specific rules first, then country-wide
  return [...stateSpecific, ...countryWide];
}
