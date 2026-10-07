"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Country, State } from "country-state-city";
import { updateOrderAddress, updateOrderCustomerEmail, updateOrderCustomerPhone, type OrderAddrField } from "@/actions/admin/update-order-address";

const inp = "w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#3DBFA4] bg-white";
const sel = "w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#3DBFA4] bg-white";
const lbl = "block text-[10px] font-semibold text-gray-500 mb-0.5";

function emptyAddr(): OrderAddrField {
  return {
    firstName: "", lastName: "", phone: "",
    address1: "", address2: "",
    city: "", state: "", stateName: "",
    zip: "", country: "US", countryName: "United States",
  };
}

function parseAddr(raw: string | null | undefined): OrderAddrField {
  if (!raw) return emptyAddr();
  try {
    const p = JSON.parse(raw);
    return {
      firstName:   p.firstName   ?? "",
      lastName:    p.lastName    ?? "",
      phone:       p.phone       ?? "",
      address1:    p.address1    ?? "",
      address2:    p.address2    ?? "",
      city:        p.city        ?? "",
      state:       p.state       ?? "",
      stateName:   p.stateName   ?? p.state ?? "",
      zip:         p.zip         ?? "",
      country:     p.country     ?? "US",
      countryName: p.countryName ?? "United States",
    };
  } catch {
    return emptyAddr();
  }
}

// ── Address edit form ───────────────────────────────────────────────────────

interface EditAddressProps {
  orderId:  string;
  type:     "billing" | "shipping";
  raw:      string | null | undefined;
}

export function EditOrderAddress({ orderId, type, raw }: EditAddressProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [addr,    setAddr]    = useState<OrderAddrField>(() => parseAddr(raw));

  const allCountries = Country.getAllCountries();
  const states       = State.getStatesOfCountry(addr.country);

  function set<K extends keyof OrderAddrField>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddr(prev => ({ ...prev, [k]: e.target.value }));
  }

  function handleCountry(e: React.ChangeEvent<HTMLSelectElement>) {
    const code    = e.target.value;
    const country = Country.getCountryByCode(code);
    setAddr(prev => ({ ...prev, country: code, countryName: country?.name ?? code, state: "", stateName: "" }));
  }

  function handleState(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    const st   = states.find(s => s.isoCode === code);
    setAddr(prev => ({ ...prev, state: code, stateName: st?.name ?? code }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await updateOrderAddress(orderId, type, addr);
    setSaving(false);
    if (res.success) {
      toast.success(`${type === "billing" ? "Billing" : "Shipping"} address updated.`);
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.message ?? "Failed to save.");
    }
  }

  function handleCancel() {
    setAddr(parseAddr(raw));
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-[#3DBFA4] transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit address
      </button>
    );
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>First Name</label>
          <input className={inp} value={addr.firstName} onChange={set("firstName")} placeholder="First name" />
        </div>
        <div>
          <label className={lbl}>Last Name</label>
          <input className={inp} value={addr.lastName} onChange={set("lastName")} placeholder="Last name" />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className={lbl}>Phone</label>
        <input className={inp} value={addr.phone} onChange={set("phone")} placeholder="+1 555 000 0000" type="tel" />
      </div>

      {/* Address lines */}
      <div>
        <label className={lbl}>Address Line 1</label>
        <input className={inp} value={addr.address1} onChange={set("address1")} placeholder="123 Main St" />
      </div>
      <div>
        <label className={lbl}>Address Line 2</label>
        <input className={inp} value={addr.address2} onChange={set("address2")} placeholder="Apt, Suite (optional)" />
      </div>

      {/* Country */}
      <div>
        <label className={lbl}>Country</label>
        <select className={sel} value={addr.country} onChange={handleCountry}>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option disabled>──────────</option>
          {allCountries.filter(c => c.isoCode !== "US" && c.isoCode !== "CA").map(c => (
            <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* City / State / Zip */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={lbl}>City</label>
          <input className={inp} value={addr.city} onChange={set("city")} placeholder="City" />
        </div>
        <div>
          <label className={lbl}>State</label>
          {states.length > 0 ? (
            <select className={sel} value={addr.state} onChange={handleState}>
              <option value="">State…</option>
              {states.map(s => (
                <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input className={inp} value={addr.state} onChange={set("state")} placeholder="State" />
          )}
        </div>
        <div>
          <label className={lbl}>ZIP</label>
          <input className={inp} value={addr.zip} onChange={set("zip")} placeholder="12345" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 bg-[#3DBFA4] hover:bg-[#35a993] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Customer phone edit ─────────────────────────────────────────────────────

interface EditPhoneProps {
  orderId: string;
  current: string | null | undefined;
}

export function EditOrderPhone({ orderId, current }: EditPhoneProps) {
  const router   = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [ph,      setPh]      = useState(current ?? "");

  async function handleSave() {
    setSaving(true);
    const res = await updateOrderCustomerPhone(orderId, ph);
    setSaving(false);
    if (res.success) {
      toast.success("Patient phone updated.");
      setEditing(false);
      router.refresh();
    } else {
      toast.error("Failed to update phone.");
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-[#3DBFA4] transition-colors"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>
    );
  }

  return (
    <div className="mt-1 flex gap-1.5 items-center">
      <input
        type="tel"
        value={ph}
        onChange={e => setPh(e.target.value)}
        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#3DBFA4]"
        placeholder="+1 555 000 0000"
      />
      <button onClick={handleSave} disabled={saving}
        className="px-2 py-1 bg-[#3DBFA4] text-white text-xs font-semibold rounded hover:bg-[#35a993] disabled:opacity-50 transition-colors">
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => { setPh(current ?? ""); setEditing(false); }}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
        Cancel
      </button>
    </div>
  );
}

// ── Customer email edit ─────────────────────────────────────────────────────

interface EditEmailProps {
  orderId: string;
  current: string | null | undefined;
}

export function EditOrderEmail({ orderId, current }: EditEmailProps) {
  const router   = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [email,   setEmail]   = useState(current ?? "");

  async function handleSave() {
    setSaving(true);
    const res = await updateOrderCustomerEmail(orderId, email);
    setSaving(false);
    if (res.success) {
      toast.success("Patient email updated.");
      setEditing(false);
      router.refresh();
    } else {
      toast.error("Failed to update email.");
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-[#3DBFA4] transition-colors"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>
    );
  }

  return (
    <div className="mt-1 flex gap-1.5 items-center">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#3DBFA4]"
        placeholder="patient@example.com"
      />
      <button onClick={handleSave} disabled={saving}
        className="px-2 py-1 bg-[#3DBFA4] text-white text-xs font-semibold rounded hover:bg-[#35a993] disabled:opacity-50 transition-colors">
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => { setEmail(current ?? ""); setEditing(false); }}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
        Cancel
      </button>
    </div>
  );
}
