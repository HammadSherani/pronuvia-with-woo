"use client";

import { useState, useEffect } from "react";
import { Country, State } from "country-state-city";

export type AddressData = {
  firstName: string;
  lastName:  string;
  company?:  string;      // optional (checkout)
  phone:     string;
  address1:  string;
  address2:  string;
  city:      string;
  state:     string;      // 2-letter code e.g. "WA"
  stateName: string;      // full name e.g. "Washington"
  zip:       string;
  country:   string;      // 2-letter code e.g. "US"
  countryName: string;    // full name e.g. "United States"
};

export const EMPTY_ADDRESS: AddressData = {
  firstName: "", lastName: "", phone: "", address1: "", address2: "",
  city: "", state: "", stateName: "", zip: "",
  country: "US", countryName: "United States",
};

const sel =
  "w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white text-gray-800 disabled:bg-gray-50 disabled:text-gray-400";
const inp =
  "w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white placeholder:text-gray-400";

interface Props {
  value:      AddressData;
  onChange:   (v: AddressData) => void;
  showName?:  boolean;
  showPhone?: boolean;
  /** "woo": labelled fields in WooCommerce's checkout order (checkout pages) */
  variant?:   "default" | "woo";
  /** Woo variant: extra fields after Phone (e.g. the patient's email) */
  children?:  React.ReactNode;
}

const wooLbl = "block text-sm font-medium text-gray-800 mb-1";
const Req = () => <span className="text-red-500"> *</span>;
const Opt = () => <span className="text-gray-400 font-normal"> (optional)</span>;

export function AddressFields({ value, onChange, showName = true, showPhone = true, variant = "default", children }: Props) {
  const [states, setStates] = useState<{ isoCode: string; name: string }[]>([]);

  // Load states when country changes
  useEffect(() => {
    if (value.country) {
      const list = State.getStatesOfCountry(value.country);
      setStates(list);
    } else {
      setStates([]);
    }
  }, [value.country]);

  const set = (k: keyof AddressData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    const country = Country.getCountryByCode(code);
    onChange({ ...value, country: code, countryName: country?.name ?? code, state: "", stateName: "" });
  }

  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    const st = states.find(s => s.isoCode === code);
    onChange({ ...value, state: code, stateName: st?.name ?? code });
  }

  const countries = Country.getAllCountries();

  const countrySelect = (
    <select className={sel} value={value.country} onChange={handleCountryChange}>
      <option value="">Select country…</option>
      {/* US first */}
      <option value="US">United States (US)</option>
      <option value="CA">Canada</option>
      <option disabled>──────────────</option>
      {countries
        .filter(c => c.isoCode !== "US" && c.isoCode !== "CA")
        .map(c => (
          <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
        ))}
    </select>
  );

  // WooCommerce checkout layout: a label over each field, in its field order
  if (variant === "woo") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={wooLbl}>First name<Req /></label>
            <input className={inp} value={value.firstName} onChange={set("firstName")} autoComplete="given-name" />
          </div>
          <div>
            <label className={wooLbl}>Last name<Req /></label>
            <input className={inp} value={value.lastName} onChange={set("lastName")} autoComplete="family-name" />
          </div>
        </div>
        <div>
          <label className={wooLbl}>Company name<Opt /></label>
          <input className={inp} value={value.company ?? ""} onChange={set("company")} autoComplete="organization" />
        </div>
        <div>
          <label className={wooLbl}>Country / Region<Req /></label>
          {countrySelect}
        </div>
        <div className="space-y-2">
          <label className={wooLbl}>Street address<Req /></label>
          <input className={inp} placeholder="House number and street name" value={value.address1} onChange={set("address1")} autoComplete="address-line1" />
          <input className={inp} placeholder="Apartment, suite, unit, etc. (optional)" value={value.address2} onChange={set("address2")} autoComplete="address-line2" />
        </div>
        <div>
          <label className={wooLbl}>Town / City<Req /></label>
          <input className={inp} value={value.city} onChange={set("city")} autoComplete="address-level2" />
        </div>
        <div>
          <label className={wooLbl}>State<Req /></label>
          {states.length > 0 ? (
            <select className={sel} value={value.state} onChange={handleStateChange}>
              <option value="">Select an option…</option>
              {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
            </select>
          ) : (
            <input className={inp} value={value.state} onChange={set("state")} />
          )}
        </div>
        <div>
          <label className={wooLbl}>ZIP Code<Req /></label>
          <input className={inp} value={value.zip} onChange={set("zip")} autoComplete="postal-code" />
        </div>
        {showPhone && (
          <div>
            <label className={wooLbl}>Phone<Req /></label>
            <input className={inp} type="tel" value={value.phone} onChange={set("phone")} autoComplete="tel" />
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showName && (
        <div className="grid grid-cols-2 gap-3">
          <input className={inp} placeholder="First name" value={value.firstName} onChange={set("firstName")} />
          <input className={inp} placeholder="Last name"  value={value.lastName}  onChange={set("lastName")} />
        </div>
      )}
      {showPhone && (
        <input className={inp} placeholder="Phone number" type="tel" value={value.phone} onChange={set("phone")} />
      )}
      <input className={inp} placeholder="Address" value={value.address1} onChange={set("address1")} />
      <input className={inp} placeholder="Apartment, suite, etc. (optional)" value={value.address2} onChange={set("address2")} />

      {/* Country dropdown */}
      {countrySelect}

      <div className="grid grid-cols-5 gap-3">
        <input className={inp + " col-span-2"} placeholder="City" value={value.city} onChange={set("city")} />

        {/* State dropdown */}
        {states.length > 0 ? (
          <select className={sel} value={value.state} onChange={handleStateChange}>
            <option value="">State…</option>
            {states.map(s => (
              <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
            ))}
          </select>
        ) : (
          <input className={inp} placeholder="State" value={value.state} onChange={set("state")} />
        )}

        <input className={inp + " col-span-2"} placeholder="ZIP code" value={value.zip} onChange={set("zip")} />
      </div>
    </div>
  );
}

/** Convert old string-based AddressData to new code-based format */
export function migrateAddressData(old: {
  firstName?: string; lastName?: string; company?: string; phone?: string; address1?: string; address2?: string;
  city?: string; state?: string; zip?: string; country?: string;
}): AddressData {
  const countryInput = old.country ?? "";
  // Try to find by code first, then by name
  let countryCode = "";
  let countryName = "";
  const allCountries = Country.getAllCountries();
  const byCode = allCountries.find(c => c.isoCode === countryInput);
  const byName = allCountries.find(c => c.name.toLowerCase() === countryInput.toLowerCase());
  if (byCode) { countryCode = byCode.isoCode; countryName = byCode.name; }
  else if (byName) { countryCode = byName.isoCode; countryName = byName.name; }
  else { countryCode = "US"; countryName = "United States"; }

  const stateInput = old.state ?? "";
  let stateCode = "";
  let stateName = "";
  const stateList = State.getStatesOfCountry(countryCode);
  const stByCode = stateList.find(s => s.isoCode === stateInput.toUpperCase());
  const stByName = stateList.find(s => s.name.toLowerCase() === stateInput.toLowerCase());
  if (stByCode) { stateCode = stByCode.isoCode; stateName = stByCode.name; }
  else if (stByName) { stateCode = stByName.isoCode; stateName = stByName.name; }
  else { stateCode = stateInput; stateName = stateInput; }

  return {
    firstName:   old.firstName   ?? "",
    lastName:    old.lastName    ?? "",
    ...(old.company && { company: old.company }),
    phone:      old.phone       ?? "",
    address1:    old.address1    ?? "",
    address2:    old.address2    ?? "",
    city:        old.city        ?? "",
    state:       stateCode,
    stateName:   stateName,
    zip:         old.zip         ?? "",
    country:     countryCode,
    countryName: countryName,
  };
}

/** Format address to a display string */
export function formatAddress(a: AddressData): string {
  const name   = `${a.firstName} ${a.lastName}`.trim();
  const street = [a.address1, a.address2].filter(Boolean).join(", ");
  const city   = [a.city, a.state, a.zip].filter(Boolean).join(", ");
  return [name, a.company, a.phone, street, city, a.countryName].filter(Boolean).join("\n");
}

/** Serialize address as JSON for storage (preserves all fields including phone) */
export function serializeAddress(a: AddressData): string {
  return JSON.stringify(a);
}

/** Format for FedEx (uses codes) */
export function addressToShipAddress(a: AddressData, nameOverride?: string) {
  return {
    name:    nameOverride ?? `${a.firstName} ${a.lastName}`.trim(),
    street1: a.address1 || "N/A",
    street2: a.address2 || undefined,
    city:    a.city,
    state:   a.state,   // 2-letter code
    zip:     a.zip,
    country: a.country, // 2-letter code
  };
}
