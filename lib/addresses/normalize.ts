import "server-only";
import { Country, State } from "country-state-city";

// One structured address, whatever format it was saved in. Codes are ISO:
// country "US", state "NY".
export type NormalizedAddress = {
  firstName: string;
  lastName:  string;
  company:   string;
  phone:     string;
  address1:  string;
  address2:  string;
  city:      string;
  state:     string;
  zip:       string;
  country:   string;
};

export const EMPTY_NORMALIZED: NormalizedAddress = {
  firstName: "", lastName: "", company: "", phone: "",
  address1: "", address2: "", city: "", state: "", zip: "", country: "",
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Accepts an ISO code or a full name ("US" / "United States").
export function toCountryCode(input: string): string {
  const v = input.trim();
  if (!v) return "";
  const all = Country.getAllCountries();
  const hit = all.find((c) => c.isoCode.toLowerCase() === v.toLowerCase())
           ?? all.find((c) => c.name.toLowerCase() === v.toLowerCase());
  if (hit) return hit.isoCode;
  if (["usa", "u.s.", "u.s.a.", "united states of america"].includes(v.toLowerCase())) return "US";
  return v.toUpperCase();
}

// Accepts a state code or name for the given country ("NY" / "New York").
export function toStateCode(input: string, countryCode: string): string {
  const v = input.trim();
  if (!v || !countryCode) return v;
  const states = State.getStatesOfCountry(countryCode);
  const hit = states.find((s) => s.isoCode.toLowerCase() === v.toLowerCase())
           ?? states.find((s) => s.name.toLowerCase() === v.toLowerCase());
  return hit ? hit.isoCode : v;
}

function finish(a: NormalizedAddress): NormalizedAddress {
  const country = toCountryCode(a.country);
  return { ...a, country, state: toStateCode(a.state, country) };
}

/**
 * Parses an address saved as a string on a user or order. Three shapes exist:
 *   - AddressData JSON from components/shared/address-fields
 *       { firstName, lastName, phone, address1, address2, city, state, zip, country }
 *   - the admin sales-rep form's JSON  { line1, line2, city, zipCode, state, country }
 *   - legacy plain text, kept as address line 1 (city/state/zip can't be trusted)
 */
export function normalizeAddressString(raw: string | null | undefined): NormalizedAddress | null {
  const text = raw?.trim();
  if (!text) return null;

  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (j && typeof j === "object") {
      if ("address1" in j || "zip" in j) {
        return finish({
          firstName: str(j.firstName), lastName: str(j.lastName), company: str(j.company),
          phone:     str(j.phone),
          address1:  str(j.address1), address2: str(j.address2),
          city:      str(j.city), state: str(j.state), zip: str(j.zip), country: str(j.country),
        });
      }
      if ("line1" in j || "zipCode" in j) {
        return finish({
          ...EMPTY_NORMALIZED,
          address1: str(j.line1), address2: str(j.line2),
          city:     str(j.city), state: str(j.state), zip: str(j.zipCode), country: str(j.country),
        });
      }
    }
  } catch {
    // not JSON — legacy free text
  }

  return { ...EMPTY_NORMALIZED, address1: text.replace(/\s*\n\s*/g, ", ") };
}

// Physicians keep their address in separate columns
export function normalizePhysicianAddress(p: {
  addressOne?: string | null; addressTwo?: string | null; city?: string | null;
  state?: string | null; zipCode?: string | null; country?: string | null; phone?: string | null;
  nameOfPractice?: string | null;
}): NormalizedAddress | null {
  if (!p.addressOne && !p.city && !p.zipCode) return null;
  return finish({
    ...EMPTY_NORMALIZED,
    company:  p.nameOfPractice ?? "",
    phone:    p.phone ?? "",
    address1: p.addressOne ?? "",
    address2: p.addressTwo ?? "",
    city:     p.city ?? "",
    state:    p.state ?? "",
    zip:      p.zipCode ?? "",
    country:  p.country ?? "",
  });
}

export function isEmptyAddress(a: NormalizedAddress | null): boolean {
  return !a || (!a.address1 && !a.city && !a.zip);
}
