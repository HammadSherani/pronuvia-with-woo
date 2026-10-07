"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Country, State } from "country-state-city";
import Select from "react-select";
import {
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
  toggleShippingRate,
} from "@/actions/admin/shipping-rates";
import { ShippingMethod } from "@/generated/prisma/enums";
import type { ShippingRateActionState } from "@/actions/admin/shipping-rates";

type ShippingRate = {
  id:          string;
  continent:   string;
  country:     string;
  countryName: string;
  states:      string[];
  stateNames:  string[];
  method:      ShippingMethod;
  cost:        number;
  isActive:    boolean;
  createdAt:   Date;
  updatedAt:   Date;
};

const CONTINENTS = ["Africa", "Americas", "Antarctica", "Asia", "Europe", "Oceania"];

// Continent → ISO country codes mapping
const CONTINENT_CODES: Record<string, string[]> = {
  Africa: ["DZ","AO","BJ","BW","BF","BI","CM","CV","CF","TD","KM","CD","CG","CI","DJ","EG","GQ","ER","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","YT","MA","MZ","NA","NE","NG","RE","RW","SH","ST","SN","SC","SL","SO","ZA","SS","SD","SZ","TZ","TG","TN","UG","ZM","ZW"],
  Americas: ["AI","AG","AR","AW","BS","BB","BZ","BM","BO","BQ","BR","VG","CA","KY","CL","CO","CR","CU","CW","DM","DO","EC","SV","FK","GF","GL","GD","GP","GT","GY","HT","HN","JM","MQ","MX","MS","NI","PA","PY","PE","PR","BL","KN","LC","MF","PM","VC","SX","SR","TT","TC","US","UY","VE","VI"],
  Antarctica: ["AQ"],
  Asia: ["AF","AM","AZ","BH","BD","BT","BN","KH","CN","CY","GE","IN","ID","IR","IQ","IL","JP","JO","KZ","KW","KG","LA","LB","MO","MY","MV","MN","MM","NP","KP","OM","PK","PS","PH","QA","SA","SG","KR","LK","SY","TW","TJ","TH","TL","TR","TM","AE","UZ","VN","YE"],
  Europe: ["AL","AD","AT","BY","BE","BA","BG","HR","CZ","DK","EE","FI","FR","DE","GI","GR","GG","HU","IS","IE","IM","IT","JE","XK","LV","LI","LT","LU","MT","MD","MC","ME","NL","MK","NO","PL","PT","RO","RU","SM","RS","SK","SI","ES","SJ","SE","CH","UA","GB","VA"],
  Oceania: ["AS","AU","CX","CC","CK","FJ","PF","GU","HM","KI","MH","FM","NR","NC","NZ","NU","NF","MP","PW","PG","PN","WS","SB","TK","TO","TV","UM","VU","WF"],
};

function getCountriesForContinent(continent: string) {
  const all = Country.getAllCountries();
  if (!continent) return all;
  const codes = CONTINENT_CODES[continent];
  if (!codes) return all;
  return all.filter((c) => codes.includes(c.isoCode));
}

const METHOD_LABELS: Record<ShippingMethod, string> = {
  FLAT:         "Flat Shipping",
  FREE:         "Free Shipping",
  LOCAL_PICKUP: "Local Pickup",
  FEDEX_2DAY:   "FedEx 2Day (Expedited)",
};

const METHOD_BADGE: Record<ShippingMethod, string> = {
  FLAT:         "bg-blue-50 text-blue-700 border-blue-200",
  FREE:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOCAL_PICKUP: "bg-violet-50 text-violet-700 border-violet-200",
  FEDEX_2DAY:   "bg-orange-50 text-orange-700 border-orange-200",
};

// Methods with a real customer-facing price — LOCAL_PICKUP and FREE are always $0.
const PRICED_METHODS: ShippingMethod[] = [ShippingMethod.FLAT, ShippingMethod.FEDEX_2DAY];

type FormState = {
  continent:      string;
  country:        string;
  countryName:    string;
  countryWide:    boolean; // true = no states, applies to entire country
  selectedStates: { code: string; name: string }[];
  method:         ShippingMethod | "";
  cost:           string;
  isActive:       boolean;
};

const EMPTY_FORM: FormState = {
  continent: "", country: "", countryName: "",
  countryWide: true, selectedStates: [],
  method: "", cost: "", isActive: true,
};

// ── State multi-select (react-select with portal) ──────────────────────────

type StateOption = { value: string; label: string; code: string };

function StateSelector({
  countryCode,
  selected,
  onChange,
}: {
  countryCode: string;
  selected:    { code: string; name: string }[];
  onChange:    (v: { code: string; name: string }[]) => void;
}) {
  const allStates = countryCode ? State.getStatesOfCountry(countryCode) : [];

  if (allStates.length === 0) {
    return <p className="text-xs text-gray-400 italic mt-1">This country has no states / provinces listed.</p>;
  }

  const options: StateOption[] = allStates.map((s) => ({
    value: s.isoCode,
    label: s.name,
    code:  s.isoCode,
  }));

  const value: StateOption[] = selected.map((s) => ({
    value: s.code,
    label: s.name,
    code:  s.code,
  }));

  return (
    <Select<StateOption, true>
      isMulti
      options={options}
      value={value}
      onChange={(opts) =>
        onChange((opts ?? []).map((o) => ({ code: o.value, name: o.label })))
      }
      placeholder="Select states / provinces…"
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      menuPosition="fixed"
      formatOptionLabel={(opt) => (
        <span className="flex items-center justify-between gap-3">
          <span>{opt.label}</span>
          <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{opt.code}</span>
        </span>
      )}
      styles={{
        control: (base, state) => ({
          ...base,
          borderColor:  state.isFocused ? "#3DBFA4" : "#d1d5db",
          boxShadow:    state.isFocused ? "0 0 0 2px rgba(61,191,164,0.25)" : "none",
          borderRadius: "0.5rem",
          fontSize:     "0.875rem",
          minHeight:    "42px",
          "&:hover":    { borderColor: "#9ca3af" },
        }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        menu:       (base) => ({ ...base, borderRadius: "0.75rem", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }),
        option:     (base, state) => ({
          ...base,
          backgroundColor: state.isSelected ? "#111827" : state.isFocused ? "#f9fafb" : "white",
          color:           state.isSelected ? "white" : "#374151",
          fontSize:        "0.875rem",
          cursor:          "pointer",
        }),
        multiValue: (base) => ({ ...base, backgroundColor: "#f3f4f6", borderRadius: "9999px", padding: "0 2px" }),
        multiValueLabel: (base) => ({ ...base, fontSize: "0.75rem", color: "#374151", padding: "2px 6px" }),
        multiValueRemove: (base) => ({
          ...base, borderRadius: "0 9999px 9999px 0",
          "&:hover": { backgroundColor: "#fee2e2", color: "#dc2626" },
        }),
        placeholder: (base) => ({ ...base, color: "#9ca3af", fontSize: "0.875rem" }),
      }}
    />
  );
}

// ── Shipping Rule Form ──────────────────────────────────────────────────────

function ShippingRateForm({
  initial,
  rateId,
  onSuccess,
  onCancel,
}: {
  initial:   FormState;
  rateId?:   string;
  onSuccess: () => void;
  onCancel:  () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const createAction = async (_state: ShippingRateActionState, fd: FormData) => createShippingRate(_state, fd);
  const updateAction = async (_state: ShippingRateActionState, fd: FormData) => updateShippingRate(rateId!, _state, fd);
  const action = rateId ? updateAction : createAction;

  const [state, dispatch, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.success) { toast.success(state.message ?? "Saved."); onSuccess(); }
    else if (state.message && !state.errors) toast.error(state.message);
  }, [state, onSuccess]);

  const countries = getCountriesForContinent(form.continent);

  function handleContinentChange(continent: string) {
    setForm({ ...form, continent, country: "", countryName: "", selectedStates: [] });
  }

  function handleCountryChange(code: string) {
    const c = Country.getCountryByCode(code);
    setForm({ ...form, country: code, countryName: c?.name ?? code, selectedStates: [] });
  }

  function handleMethodChange(method: ShippingMethod | "") {
    const priced = method !== "" && PRICED_METHODS.includes(method);
    setForm({ ...form, method, cost: priced ? form.cost : "0" });
  }

  return (
    <form action={dispatch} className="space-y-4">
      {/* Hidden serialised fields */}
      <input type="hidden" name="continent"   value={form.continent} />
      <input type="hidden" name="country"     value={form.country} />
      <input type="hidden" name="countryName" value={form.countryName} />
      <input type="hidden" name="states"      value={JSON.stringify(form.countryWide ? [] : form.selectedStates.map((s) => s.code))} />
      <input type="hidden" name="stateNames"  value={JSON.stringify(form.countryWide ? [] : form.selectedStates.map((s) => s.name))} />
      <input type="hidden" name="method"      value={form.method} />
      <input type="hidden" name="cost"        value={form.cost || "0"} />
      {rateId && <input type="hidden" name="isActive" value={String(form.isActive)} />}

      {/* Continent */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Continent</label>
        <select
          value={form.continent}
          onChange={(e) => handleContinentChange(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3DBFA4] bg-white"
        >
          <option value="">Select continent…</option>
          {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {state?.errors?.continent && <p className="text-xs text-red-600 mt-1">{state.errors.continent[0]}</p>}
      </div>

      {/* Country */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
        <select
          value={form.country}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3DBFA4] bg-white"
        >
          <option value="">Select country…</option>
          {countries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
        </select>
        {state?.errors?.country && <p className="text-xs text-red-600 mt-1">{state.errors.country[0]}</p>}
      </div>

      {/* Scope: country-wide vs specific states */}
      {form.country && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Country-wide option */}
          <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="scopeType"
              checked={form.countryWide}
              onChange={() => setForm({ ...form, countryWide: true, selectedStates: [] })}
              className="mt-0.5 accent-gray-900"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">Entire Country</p>
              <p className="text-xs text-gray-400 mt-0.5">
                This rule applies to all of {form.countryName}
              </p>
            </div>
          </label>

          {/* State-specific option */}
          <label className="flex items-start gap-3 px-4 py-3 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="scopeType"
              checked={!form.countryWide}
              onChange={() => setForm({ ...form, countryWide: false })}
              className="mt-0.5 accent-gray-900"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Specific State(s) / Province(s)</p>
              <p className="text-xs text-gray-400 mt-0.5">Select one or more states</p>
            </div>
          </label>

          {/* State selector — only when specific states is chosen */}
          {!form.countryWide && (
            <div className="px-4 pb-4">
              <StateSelector
                countryCode={form.country}
                selected={form.selectedStates}
                onChange={(v) => setForm({ ...form, selectedStates: v })}
              />
              {!form.countryWide && form.selectedStates.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">Select at least one state to continue.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shipping Method */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Shipping Method</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(METHOD_LABELS) as ShippingMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleMethodChange(m)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                form.method === m
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
        {state?.errors?.method && <p className="text-xs text-red-600 mt-1">{state.errors.method[0]}</p>}
      </div>

      {/* Cost — FLAT and FEDEX_2DAY only (FREE / LOCAL_PICKUP are always $0) */}
      {form.method !== "" && PRICED_METHODS.includes(form.method) && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Shipping Cost (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number" min="0.01" step="0.01" placeholder="0.00"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3DBFA4]"
            />
          </div>
          {state?.errors?.cost && <p className="text-xs text-red-600 mt-1">{state.errors.cost[0]}</p>}
        </div>
      )}

      {/* Active toggle (edit only) */}
      {rateId && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 accent-gray-900" />
          <span className="text-sm text-gray-700">Active</span>
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={
            pending || !form.continent || !form.country || !form.method ||
            (!form.countryWide && form.selectedStates.length === 0)
          }
          className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </span>
          ) : rateId ? "Update Rule" : "Create Rule"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main Client Component ───────────────────────────────────────────────────

export function ShippingRatesClient({ initialRates }: { initialRates: ShippingRate[] }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [rates,     setRates]     = useState<ShippingRate[]>(initialRates);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterContinent, setFilterContinent] = useState(searchParams.get("continent") ?? "");
  const [filterCountry,   setFilterCountry]   = useState(searchParams.get("country")   ?? "");
  const [filterMethod,    setFilterMethod]    = useState(searchParams.get("method")    ?? "");

  const [togglingId,    setTogglingId]    = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [deletePending, startDelete]      = useTransition();

  useEffect(() => { setRates(initialRates); }, [initialRates]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (filterContinent) params.set("continent", filterContinent);
    if (filterCountry)   params.set("country",   filterCountry);
    if (filterMethod)    params.set("method",     filterMethod);
    router.push(`/admin/shipping-rates?${params.toString()}`);
  }

  function clearFilters() {
    setFilterContinent(""); setFilterCountry(""); setFilterMethod("");
    router.push("/admin/shipping-rates");
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    const res = await toggleShippingRate(id);
    setTogglingId(null);
    if (res?.success) toast.success(res.message ?? "Updated.");
    else toast.error(res?.message ?? "Failed.");
  }

  function confirmDelete(id: string) {
    startDelete(async () => {
      const res = await deleteShippingRate(id);
      setDeletingId(null);
      if (res?.success) toast.success(res.message ?? "Deleted.");
      else toast.error(res?.message ?? "Failed.");
    });
  }

  const editingRate = editingId ? rates.find((r) => r.id === editingId) : null;

  function buildEditForm(rate: ShippingRate): FormState {
    return {
      continent:      rate.continent,
      country:        rate.country,
      countryName:    rate.countryName,
      countryWide:    rate.states.length === 0,
      selectedStates: rate.states.map((code, i) => ({ code, name: rate.stateNames[i] ?? code })),
      method:         rate.method,
      cost:           rate.cost > 0 ? String(rate.cost) : "",
      isActive:       rate.isActive,
    };
  }

  const hasFilters = filterContinent || filterCountry || filterMethod;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shipping Rates</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage shipping rules applied automatically at checkout</p>
        </div>
        {!showForm && !editingId && (
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Shipping Rule
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-800 mb-4">New Shipping Rule</h2>
          <ShippingRateForm initial={EMPTY_FORM} onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Edit Form */}
      {editingId && editingRate && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Edit Shipping Rule</h2>
          <ShippingRateForm initial={buildEditForm(editingRate)} rateId={editingId}
            onSuccess={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={filterContinent} onChange={(e) => setFilterContinent(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3DBFA4] bg-white">
            <option value="">All Continents</option>
            {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" placeholder="Filter by country name…" value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3DBFA4]" />
          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3DBFA4] bg-white">
            <option value="">All Methods</option>
            {(Object.keys(METHOD_LABELS) as ShippingMethod[]).map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={applyFilters}
            className="px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors">
            Apply Filters
          </button>
          {hasFilters && (
            <button onClick={clearFilters}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 self-center">
            {rates.length} rule{rates.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-500">No shipping rules found</p>
            <p className="text-xs text-gray-400 mt-1">
              {hasFilters ? "Try adjusting your filters" : "Create your first shipping rule to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {["Continent", "Location", "Method", "Cost", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Continent */}
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{rate.continent}</td>

                    {/* Location */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-800">{rate.countryName}</p>
                      {rate.states.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rate.stateNames.slice(0, 3).map((s, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-medium">{s}</span>
                          ))}
                          {rate.stateNames.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">+{rate.stateNames.length - 3} more</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-0.5">Entire country</p>
                      )}
                    </td>

                    {/* Method */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 border rounded-full text-xs font-semibold ${METHOD_BADGE[rate.method]}`}>
                        {METHOD_LABELS[rate.method]}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="px-5 py-4 text-sm font-semibold text-gray-800">
                      {rate.method === "FREE" || rate.method === "LOCAL_PICKUP"
                        ? <span className="text-emerald-600">Free</span>
                        : `$${rate.cost.toFixed(2)}`
                      }
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <button onClick={() => handleToggle(rate.id)} disabled={togglingId === rate.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          rate.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                        } disabled:opacity-50`}>
                        {togglingId === rate.id
                          ? <span className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          : <span className={`w-1.5 h-1.5 rounded-full ${rate.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                        }
                        {rate.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {deletingId === rate.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Delete?</span>
                            <button onClick={() => confirmDelete(rate.id)} disabled={deletePending}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                              {deletePending ? "…" : "Yes"}
                            </button>
                            <button onClick={() => setDeletingId(null)}
                              className="px-2.5 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(rate.id); setShowForm(false); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeletingId(rate.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
        <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-xs text-blue-700 leading-relaxed space-y-1">
          <p><strong>Entire Country</strong> — rule applies to all customers in that country.</p>
          <p><strong>Specific State(s)</strong> — rule applies only to selected states; state-specific rules take priority at checkout.</p>
          <p><strong>Flat Shipping</strong> — fixed fee. <strong>Free Shipping</strong> / <strong>Local Pickup</strong> — no charge.</p>
        </div>
      </div>
    </div>
  );
}
