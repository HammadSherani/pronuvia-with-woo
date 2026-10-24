import "server-only";
import { Country, State } from "country-state-city";
import { wooFetch } from "./client";

// WooCommerce shipping zones and their methods, read only, for the admin
// Shipping Rates page (they are added and changed in WP admin).

type WooZone     = { id: number; name: string; order: number };
type WooLocation = { code: string; type: "country" | "state" | "postcode" | "continent" };
type WooMethod   = {
  instance_id: number; method_id: string; title: string; enabled: boolean; order: number;
  settings?: Record<string, { value?: string } | undefined>;
};

export type ShippingMethodRow = {
  id: number; title: string; type: string; enabled: boolean;
  cost: string | null;          // flat rate cost as set in Woo (may be a formula)
  minAmount: string | null;     // free shipping: minimum order
  taxable: boolean;
};
export type ShippingZoneRow = { id: number; name: string; regions: string[]; methods: ShippingMethodRow[] };

const CONTINENTS: Record<string, string> = {
  AF: "Africa", AN: "Antarctica", AS: "Asia", EU: "Europe", NA: "North America", OC: "Oceania", SA: "South America",
};
const TYPES: Record<string, string> = { flat_rate: "Flat rate", free_shipping: "Free shipping", local_pickup: "Local pickup" };

function regionName(l: WooLocation): string {
  if (l.type === "continent") return CONTINENTS[l.code] ?? l.code;
  if (l.type === "country")   return Country.getCountryByCode(l.code)?.name ?? l.code;
  if (l.type === "state") {
    const [country, state] = l.code.split(":");
    const name = State.getStateByCodeAndCountry(state, country)?.name;
    return name ? `${name}, ${country}` : l.code;
  }
  return `Postcode ${l.code}`;
}

export async function getShippingZones(): Promise<ShippingZoneRow[]> {
  const { data: zones } = await wooFetch<WooZone[]>("wc/v3/shipping/zones");
  const rows = await Promise.all(zones.map(async (z) => {
    const [{ data: locations }, { data: methods }] = await Promise.all([
      wooFetch<WooLocation[]>(`wc/v3/shipping/zones/${z.id}/locations`),
      wooFetch<WooMethod[]>(`wc/v3/shipping/zones/${z.id}/methods`),
    ]);
    return {
      id: z.id, order: z.order,
      name: z.id === 0 ? "Everywhere else (not in a zone)" : z.name.replace(/:\s*$/, ""),
      regions: locations.map(regionName),
      methods: [...methods].sort((a, b) => a.order - b.order).map((m) => ({
        id: m.instance_id, title: m.title, type: TYPES[m.method_id] ?? m.method_id, enabled: m.enabled,
        cost:      m.settings?.cost?.value || null,
        minAmount: m.settings?.min_amount?.value || null,
        taxable:   m.settings?.tax_status?.value === "taxable",
      })),
    };
  }));
  // Woo's zone order; the catch-all zone (id 0) last
  return rows.sort((a, b) => (a.id === 0 ? 1 : 0) - (b.id === 0 ? 1 : 0) || a.order - b.order)
    .map((z) => ({ id: z.id, name: z.name, regions: z.regions, methods: z.methods }));
}
