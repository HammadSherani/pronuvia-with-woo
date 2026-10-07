"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Country, State } from "country-state-city";
import type { PhysicianActionState } from "@/actions/admin/manage-physicians";

type SalesRepOption = { id: string; name: string; email: string };

interface PhysicianFormProps {
  action: (state: PhysicianActionState, formData: FormData) => Promise<PhysicianActionState>;
  submitLabel: string;
  backHref: string;
  successRedirect?: string;
  hideCommission?: boolean;
  showNoteField?: boolean;
  showDualCreate?: boolean;
  requirePracticeFields?: boolean;
  salesReps?: SalesRepOption[];
  defaults?: {
    firstName?: string; lastName?: string; email?: string; loginId?: string; phone?: string;
    officeContactNumber?: string; fax?: string;
    aictherapy?: string; license?: string; websiteLink?: string;
    addressOne?: string; addressTwo?: string; city?: string; state?: string; zipCode?: string; country?: string;
    nameOfPractice?: string; yearsInPractice?: number;
    credential?: string; patientsPerMonth?: number;
    fieldsOfSpeciality?: string[]; commission?: number; uplineCommission?: number;
    salesRepId?: string; salesRepName?: string;
    bankName?: string; bankAccountNumber?: string; bankAccountName?: string; swiftCode?: string; routingNumber?: string;
  };
}

const base = "w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-1 transition bg-white";
const ok = "border-gray-200 focus:border-gray-900 focus:ring-gray-900";
const errCls = "border-red-300 focus:border-red-400 focus:ring-red-300";
const icls = (e?: string) => `${base} ${e ? errCls : ok}`;
const sec = "bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5";
const head = "text-sm font-semibold text-gray-700 mb-4 pb-3 border-b border-gray-100";
const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

function FE({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;
}
function Req() { return <span className="text-red-400"> *</span>; }


// ── Main form ──────────────────────────────────────────────────────
export function PhysicianForm({
  action, submitLabel, backHref, successRedirect, hideCommission, showNoteField, showDualCreate, requirePracticeFields, defaults, salesReps = [],
}: PhysicianFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const router = useRouter();

  // Password fields only make sense when creating a new account — editing an
  // existing physician has its own dedicated password-reset UI (see the edit page).
  const isCreate = !defaults;

  const [specialties, setSpecialties] = useState<string[]>(defaults?.fieldsOfSpeciality ?? []);
  const [customSpecialty, setCustom] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [accNum, setAccNum] = useState(defaults?.bankAccountNumber ?? "");
  const [confirmAccNum, setConfirmAccNum] = useState(defaults?.bankAccountNumber ?? "");
  const [accNumError, setAccNumError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedCountry, setSelectedCountry] = useState(defaults?.country ?? "");
  const [selectedState, setSelectedState]     = useState(defaults?.state ?? "");

  // Bank fields as controlled state so they survive React's form-reset after server action
  const [bankName, setBankName]               = useState(defaults?.bankName ?? "");
  const [swiftCode, setSwiftCode]             = useState(defaults?.swiftCode ?? "");
  const [bankAccountName, setBankAccountName] = useState(defaults?.bankAccountName ?? "");
  const [routingNumber, setRoutingNumber]     = useState(defaults?.routingNumber ?? "");

  const allCountries = Country.getAllCountries();
  const statesForCountry = selectedCountry ? State.getStatesOfCountry(selectedCountry) : [];

  const initRepId = state?.values?.salesRepId ?? defaults?.salesRepId ?? "";
  const [hasUpline, setHasUpline] = useState(!!initRepId);
  const [selectedRepId, setSelectedRepId] = useState(initRepId);
  const [repSearch, setRepSearch] = useState("");

  const selectedRep = salesReps.find((r) => r.id === selectedRepId);
  const filteredReps = repSearch
    ? salesReps.filter((r) =>
      r.name.toLowerCase().includes(repSearch.toLowerCase()) ||
      r.email.toLowerCase().includes(repSearch.toLowerCase())
    )
    : salesReps;

  function validateAccNums(a: string, b: string) {
    if (b && a !== b) setAccNumError("Account numbers do not match");
    else setAccNumError("");
  }

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? "Saved successfully");
      if (successRedirect) router.push(successRedirect);
    } else if (state.message && !state.errors) {
      toast.error(state.message);
    } else if (state.errors) {
      const firstError = Object.values(state.errors).flat()[0];
      if (firstError) toast.error(firstError);
    }

    // Restore controlled fields after server-action form reset
    if (state.values) {
      const v = state.values;
      if (v.country)          setSelectedCountry(v.country);
      if (v.state)            setSelectedState(v.state);
      if (v.bankName)         setBankName(v.bankName);
      if (v.swiftCode)        setSwiftCode(v.swiftCode);
      if (v.bankAccountName)  setBankAccountName(v.bankAccountName);
      if (v.bankAccountNumber) {
        setAccNum(v.bankAccountNumber);
        setConfirmAccNum(v.bankAccountNumber);
      }
      if (v.routingNumber)    setRoutingNumber(v.routingNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const e = state?.errors ?? {};

  function toggleSpecialty(s: string) {
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function addCustom() {
    // Supports pasting/typing several specialties at once, comma-separated —
    // each becomes its own tag instead of one long combined entry.
    const parts = customSpecialty.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      setSpecialties((prev) => {
        const next = [...prev];
        for (const p of parts) if (!next.includes(p)) next.push(p);
        return next;
      });
    }
    setCustom("");
  }

  function onPasswordChange(val: string) {
    setPassword(val);
    if (confirmPassword) setPasswordError(val !== confirmPassword ? "Passwords do not match" : "");
  }
  function onConfirmPasswordChange(val: string) {
    setConfirmPassword(val);
    setPasswordError(val !== password ? "Passwords do not match" : "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (isCreate && password !== confirmPassword) {
      e.preventDefault();
      setPasswordError("Passwords do not match");
      return;
    }
    setPasswordError("");

    if (accNum && accNum !== confirmAccNum) {
      e.preventDefault();
      setAccNumError("Account numbers do not match");
      return;
    }
    setAccNumError("");
  }

  function onAccNumChange(val: string) {
    setAccNum(val);
    if (confirmAccNum) setAccNumError(val !== confirmAccNum ? "Account numbers do not match" : "");
  }

  function onConfirmChange(val: string) {
    setConfirmAccNum(val);
    setAccNumError(val !== accNum ? "Account numbers do not match" : "");
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="fieldsOfSpeciality" value={JSON.stringify(specialties)} />

      {/* ── Personal Info ─────────────────────────────────── */}
      <div className={sec}>
        <p className={head}>Personal Information</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>First Name<Req /></label>
            <input name="firstName" className={icls(e.firstName?.[0])} placeholder="Jane" defaultValue={state?.values?.firstName ?? defaults?.firstName} />
            <FE msg={e.firstName?.[0]} />
          </div>
          <div>
            <label className={lbl}>Last Name<Req /></label>
            <input name="lastName" className={icls(e.lastName?.[0])} placeholder="Doe" defaultValue={state?.values?.lastName ?? defaults?.lastName} />
            <FE msg={e.lastName?.[0]} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Email<Req /></label>
            <input name="email" type="email" className={icls(e.email?.[0])} placeholder="doctor@clinic.com" defaultValue={state?.values?.email ?? defaults?.email} />
            <FE msg={e.email?.[0]} />
          </div>
          <div>
            <label className={lbl}>Login ID / Username<Req /></label>
            <input name="loginId" type="text" autoComplete="username" className={icls(e.loginId?.[0])} placeholder="e.g. dr.jane.doe" defaultValue={state?.values?.loginId ?? defaults?.loginId} />
            <FE msg={e.loginId?.[0]} />
            <p className="text-[11px] text-gray-400 mt-1">Used to sign in (3–64 characters — letters, numbers, . _ - @ +; email addresses allowed)</p>
          </div>
        </div>
        {isCreate && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={lbl}>Password<Req /></label>
              <input name="password" type="password" autoComplete="new-password" className={icls(e.password?.[0] || passwordError)}
                placeholder="At least 8 characters" value={password} onChange={(ev) => onPasswordChange(ev.target.value)} />
              <FE msg={e.password?.[0]} />
            </div>
            <div>
              <label className={lbl}>Confirm Password<Req /></label>
              <input type="password" autoComplete="new-password" className={icls(e.confirmPassword?.[0] || passwordError)}
                placeholder="Re-enter password" value={confirmPassword} onChange={(ev) => onConfirmPasswordChange(ev.target.value)} />
              {passwordError ? <p className="text-xs text-red-500 mt-1">{passwordError}</p> : <FE msg={e.confirmPassword?.[0]} />}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Phone<Req /></label>
            <input name="phone" className={icls(e.phone?.[0])} placeholder="+1 555 000 0000" defaultValue={state?.values?.phone ?? defaults?.phone} />
            <FE msg={e.phone?.[0]} />
          </div>
          <div>
            <label className={lbl}>Office Contact Number</label>
            <input name="officeContactNumber" className={icls()} placeholder="+1 555 000 0001" defaultValue={state?.values?.officeContactNumber ?? defaults?.officeContactNumber} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Fax <span className="font-normal text-gray-400">(Optional)</span></label>
            <input name="fax" className={icls()} placeholder="+1 555 000 0002" defaultValue={state?.values?.fax ?? defaults?.fax} />
          </div>
        </div>
      </div>

      {/* ── Commission (admin only) ────────────────────────── */}
      {!hideCommission && (
        <div className={sec}>
          <p className={head}>Commission Settings</p>

          {/* Doctor's commission */}
          <div className="mb-5">
            <label className={lbl}>
              Doctor&apos;s Commission %
              <span className="ml-1.5 text-xs font-normal text-gray-400">earned on their own orders</span>
            </label>
            <div className="relative">
              <input name="commission" type="number" step="0.01" min="0" max="100"
                className={icls(e.commission?.[0])} placeholder="0.00"
                defaultValue={state?.values?.commission ?? defaults?.commission ?? 0} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">%</span>
            </div>
            <FE msg={e.commission?.[0]} />
          </div>

          {/* Has Upline toggle */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                const next = !hasUpline;
                setHasUpline(next);
                if (!next) { setSelectedRepId(""); setRepSearch(""); }
              }}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${hasUpline ? "bg-gray-900" : "bg-gray-300"}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${hasUpline ? "translate-x-5" : "translate-x-0"}`} />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Assign Medical Representative (Upline)
              </span>
            </button>
          </div>

          {/* Hidden salesRepId — always submitted */}
          <input type="hidden" name="salesRepId" value={hasUpline ? selectedRepId : ""} />

          {/* Sales Rep selector */}
          {hasUpline && (
            <div className="border border-gray-100 rounded-xl bg-gray-50 p-4 mb-4 space-y-3">
              <label className={lbl}>Select Medical Representative<Req /></label>

              {/* Selected rep display */}
              {selectedRep && (
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{selectedRep.name}</p>
                    <p className="text-xs text-gray-500">{selectedRep.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedRepId(""); setRepSearch(""); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Search input */}
              {!selectedRep && (
                <>
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={repSearch}
                    onChange={(e) => setRepSearch(e.target.value)}
                    className={`${base} ${ok}`}
                  />
                  {salesReps.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No Medical Representatives found. Add one first under Admin → Sales Reps.
                    </p>
                  ) : filteredReps.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1">No results for &ldquo;{repSearch}&rdquo;</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                      {filteredReps.map((rep) => (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => { setSelectedRepId(rep.id); setRepSearch(""); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors cursor-pointer"
                        >
                          <p className="text-sm font-medium text-gray-800">{rep.name}</p>
                          <p className="text-xs text-gray-500">{rep.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Upline commission — only when rep is selected */}
              {selectedRepId && (
                <div className="pt-1">
                  <label className={lbl}>
                    Medical Rep&apos;s Upline Commission %
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      {`earned by ${selectedRep?.name ?? "this rep"} on this doctor's orders`}
                    </span>
                  </label>
                  <div className="relative">
                    <input name="uplineCommission" type="number" step="0.01" min="0" max="100"
                      className={icls(e.uplineCommission?.[0])} placeholder="0.00"
                      defaultValue={state?.values?.uplineCommission ?? defaults?.uplineCommission ?? 0} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">%</span>
                  </div>
                  <FE msg={e.uplineCommission?.[0]} />
                </div>
              )}
            </div>
          )}

          {/* uplineCommission hidden = 0 when no upline */}
          {!hasUpline && <input type="hidden" name="uplineCommission" value="0" />}
        </div>
      )}

      {/* ── Practice Info ─────────────────────────────────── */}
      <div className={sec}>
        <p className={head}>Practice Information</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Name of Practice{requirePracticeFields && <Req />}</label>
            <input name="nameOfPractice" className={icls(e.nameOfPractice?.[0])} placeholder="City Health Clinic" defaultValue={state?.values?.nameOfPractice ?? defaults?.nameOfPractice} />
            <FE msg={e.nameOfPractice?.[0]} />
          </div>
          <div>
            <label className={lbl}>Years in Practice <span className="text-red-500">*</span></label>
            <input name="yearsInPractice" type="number" min="0" required className={icls(e.yearsInPractice?.[0])} placeholder="10" defaultValue={state?.values?.yearsInPractice ?? defaults?.yearsInPractice} />
            <FE msg={e.yearsInPractice?.[0]} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Credential <span className="font-normal text-gray-400">(Optional)</span></label>
            <input name="credential" className={icls(e.credential?.[0])} placeholder="e.g. MD, DO, DC, ND, RN" defaultValue={state?.values?.credential ?? defaults?.credential} />
            <FE msg={e.credential?.[0]} />
          </div>
          <div>
            <label className={lbl}>Patients Seen Per Month <span className="font-normal text-gray-400">(Optional)</span></label>
            <input name="patientsPerMonth" type="number" min="0" className={icls(e.patientsPerMonth?.[0])} placeholder="40" defaultValue={state?.values?.patientsPerMonth ?? defaults?.patientsPerMonth} />
            <FE msg={e.patientsPerMonth?.[0]} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>License Number{requirePracticeFields && <Req />}</label>
            <input name="license" className={icls(e.license?.[0])} placeholder="LIC-000000" defaultValue={state?.values?.license ?? defaults?.license} />
            <FE msg={e.license?.[0]} />
          </div>
          <div>
            <label className={lbl}>How did you hear about AIC Therapy?</label>
            <input name="aictherapy" className={icls()} placeholder="Referral, Online, etc." defaultValue={state?.values?.aictherapy ?? defaults?.aictherapy} />
          </div>
        </div>
        <div>
          <label className={lbl}>Website</label>
          <input name="websiteLink" type="url" className={icls(e.websiteLink?.[0])} placeholder="https://clinic.com" defaultValue={state?.values?.websiteLink ?? defaults?.websiteLink ?? ""} />
          <FE msg={e.websiteLink?.[0]} />
        </div>
      </div>

      {/* ── Address ───────────────────────────────────────── */}
      <div className={sec}>
        <p className={head}>Practice Address</p>
        <div className="mb-4">
          <label className={lbl}>Address Line 1{requirePracticeFields && <Req />}</label>
          <input name="addressOne" className={icls(e.addressOne?.[0])} placeholder="123 Medical Drive" defaultValue={state?.values?.addressOne ?? defaults?.addressOne} />
          <FE msg={e.addressOne?.[0]} />
        </div>
        <div className="mb-4">
          <label className={lbl}>Address Line 2 <span className="text-xs font-normal text-gray-400">(Optional)</span></label>
          <input name="addressTwo" className={icls()} placeholder="Suite 400" defaultValue={state?.values?.addressTwo ?? defaults?.addressTwo} />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>City{requirePracticeFields && <Req />}</label>
            <input name="city" className={icls(e.city?.[0])} placeholder="Los Angeles" defaultValue={state?.values?.city ?? defaults?.city} />
            <FE msg={e.city?.[0]} />
          </div>
          <div>
            <label className={lbl}>ZIP Code{requirePracticeFields && <Req />}</label>
            <input name="zipCode" className={icls(e.zipCode?.[0])} placeholder="90001" defaultValue={state?.values?.zipCode ?? defaults?.zipCode} />
            <FE msg={e.zipCode?.[0]} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Country<Req /></label>
            <select
              name="country"
              value={selectedCountry}
              onChange={(ev) => { setSelectedCountry(ev.target.value); setSelectedState(""); }}
              className={icls(e.country?.[0])}
            >
              <option value="">Select Country</option>
              {allCountries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </option>
              ))}
            </select>
            <FE msg={e.country?.[0]} />
          </div>
          <div>
            <label className={lbl}>State / Province<Req /></label>
            {statesForCountry.length > 0 ? (
              <select
                name="state"
                value={selectedState}
                onChange={(ev) => setSelectedState(ev.target.value)}
                className={icls(e.state?.[0])}
              >
                <option value="">Select State</option>
                {statesForCountry.map((s) => (
                  <option key={s.isoCode} value={s.isoCode}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="state"
                value={selectedState}
                onChange={(ev) => setSelectedState(ev.target.value)}
                className={icls(e.state?.[0])}
                placeholder="State / Province"
              />
            )}
            <FE msg={e.state?.[0]} />
          </div>
        </div>
      </div>

      {/* ── Bank Details ──────────────────────────────────── */}
      <div className={sec}>
        <p className={head}>Bank / Payout Details</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Bank Name</label>
            <input name="bankName" className={icls()} placeholder="e.g. Chase Bank"
              value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>SWIFT (for International)</label>
            <input name="swiftCode" className={icls()} placeholder="e.g. CHASUS33"
              value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} />
          </div>
        </div>
        <div className="mb-4">
          <label className={lbl}>Account Name</label>
          <input name="bankAccountName" className={icls()} placeholder="Jane Doe"
            value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Account Number</label>
            <input name="bankAccountNumber" className={icls(accNumError)} placeholder="000000000"
              value={accNum} onChange={(e) => onAccNumChange(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Confirm Account Number</label>
            <input className={icls(accNumError)} placeholder="Re-enter account number"
              value={confirmAccNum} onChange={(e) => onConfirmChange(e.target.value)} />
            {accNumError && <p className="text-xs text-red-500 mt-1">{accNumError}</p>}
          </div>
        </div>
        <div>
          <label className={lbl}>Routing Number</label>
          <input name="routingNumber" className={icls()} placeholder="e.g. 021000021"
            value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} />
        </div>
      </div>

      {/* ── Specialties ───────────────────────────────────── */}
      <div className={sec}>
        <p className={head}>Fields of Speciality<Req /></p>
        <div className="flex gap-2">
          <input value={customSpecialty} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            className={`${base} ${ok} flex-1`} placeholder="e.g. Cardiology, Neurology" />
          <button type="button" onClick={addCustom}
            className="px-5 py-2.5 bg-[#3DBFA4] hover:bg-[#2ea88f] text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm">
            Add
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Type specialty and click Add — separate multiple specialties with commas (e.g. &ldquo;Cardiology, Neurology&rdquo;)
        </p>
        {(e as Record<string, string[]>).fieldsOfSpeciality?.[0] && (
          <p className="text-xs text-red-500 mt-1">{(e as Record<string, string[]>).fieldsOfSpeciality[0]}</p>
        )}
        {specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-900/10 text-[#3DBFA4] text-xs rounded-full font-medium">
                {s}
                <button type="button" onClick={() => toggleSpecialty(s)}
                  className="hover:text-red-500 transition-colors cursor-pointer">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {showDualCreate ? (
          <>
            <button
              type="submit"
              name="approvalAction"
              value="approve"
              disabled={pending}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
            >
              {pending && <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
              Create &amp; Approve
            </button>
            <button
              type="submit"
              name="approvalAction"
              value="pending"
              disabled={pending}
              className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
            >
              {pending && <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
              Create &amp; Pending Approval
            </button>
          </>
        ) : (
          <button type="submit" disabled={pending}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2">
            {pending && <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
            {pending ? "Saving…" : submitLabel}
          </button>
        )}
        <a href={backHref} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
