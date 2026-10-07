"use client";

import { useState, useEffect } from "react";
import { Country, State } from "country-state-city";

export type AddressData = {
  firstName: string;
  lastName:  string;
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
}

export function AddressFields({ value, onChange, showName = true, showPhone = true }: Props) {
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
      <select className={sel} value={value.country} onChange={handleCountryChange}>
        <option value="">Select country…</option>
        {/* US first */}
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option disabled>──────────────</option>
        {countries
          .filter(c => c.isoCode !== "US" && c.isoCode !== "CA")
          .map(c => (
            <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
          ))}
      </select>

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
  firstName?: string; lastName?: string; phone?: string; address1?: string; address2?: string;
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
    phone:       old.phone       ?? "",
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
  return [name, a.phone, street, city, a.countryName].filter(Boolean).join("\n");
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
