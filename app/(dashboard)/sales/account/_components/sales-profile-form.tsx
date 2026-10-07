"use client";

import { useActionState, useRef, useState } from "react";
import { Country, State } from "country-state-city";
import { updateSalesRepProfile } from "@/actions/sales-rep/profile";

type Rep = {
  firstName: string; lastName: string; email: string;
  phone?: string | null; website?: string | null;
  billingAddress?: string | null; shippingAddress?: string | null;
  bankName?: string | null; bankAccountName?: string | null; bankAccountNumber?: string | null;
  swiftCode?: string | null; routingNumber?: string | null;
};

function Field({
  label, name, defaultValue, type = "text", placeholder, error, readOnly,
}: {
  label: string; name: string; defaultValue?: string | null;
  type?: string; placeholder?: string; error?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        type={type} name={name} defaultValue={defaultValue ?? ""}
        placeholder={placeholder} readOnly={readOnly}
        className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
          readOnly
            ? "bg-gray-50 text-gray-400 cursor-default border-gray-100"
            : error
            ? "border-red-300 bg-red-50"
            : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

type AddrFields = { line1: string; line2: string; city: string; zipCode: string; country: string; state: string };
const emptyAddr = (): AddrFields => ({ line1: "", line2: "", city: "", zipCode: "", country: "", state: "" });

function parseAddr(raw?: string | null): AddrFields {
  if (!raw) return emptyAddr();
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && "line1" in p)
      return { line1: p.line1 ?? "", line2: p.line2 ?? "", city: p.city ?? "", zipCode: p.zipCode ?? "", country: p.country ?? "", state: p.state ?? "" };
  } catch { /* fall through */ }
  return { line1: raw, line2: "", city: "", zipCode: "", country: "", state: "" };
}

const inputCls = (err?: boolean) =>
  `w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
    err ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
  }`;
const lbl = "block text-xs font-medium text-gray-500 mb-1.5";

export function SalesProfileForm({ rep }: { rep: Rep }) {
  const [state, action, pending]          = useActionState(updateSalesRepProfile, undefined);
  const formRef                           = useRef<HTMLFormElement>(null);
  const [accNum,        setAccNum]        = useState(rep.bankAccountNumber ?? "");
  const [confirmAccNum, setConfirmAccNum] = useState(rep.bankAccountNumber ?? "");
  const [accNumError,   setAccNumError]   = useState("");

  const [billing,  setBilling]  = useState<AddrFields>(() => parseAddr(rep.billingAddress));
  const [shipping, setShipping] = useState<AddrFields>(() => parseAddr(rep.shippingAddress));

  const allCountries   = Country.getAllCountries();
  const billingStates  = billing.country  ? State.getStatesOfCountry(billing.country)  : [];
  const shippingStates = shipping.country ? State.getStatesOfCountry(shipping.country) : [];

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    if (accNum && accNum !== confirmAccNum) {
      ev.preventDefault();
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
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-6">
      {state?.message && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {state.message}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Profile updated successfully.
        </div>
      )}

      {/* Personal info */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Info</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" name="firstName" defaultValue={rep.firstName} error={state?.errors?.firstName?.[0]} />
          <Field label="Last Name"  name="lastName"  defaultValue={rep.lastName}  error={state?.errors?.lastName?.[0]} />
          <Field label="Email (read-only)" name="_email" defaultValue={rep.email} readOnly />
          <Field label="Phone" name="phone" defaultValue={rep.phone} placeholder="+1 (555) 000-0000" error={state?.errors?.phone?.[0]} />
          <div className="col-span-2">
            <Field label="Website" name="website" type="url" defaultValue={rep.website} placeholder="https://yoursite.com" error={state?.errors?.website?.[0]} />
          </div>
        </div>
      </div>

      {/* Serialize structured addresses as JSON */}
      <input type="hidden" name="billingAddress"  value={JSON.stringify(billing)} />
      <input type="hidden" name="shippingAddress" value={JSON.stringify(shipping)} />

      {/* Billing Address */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Billing Address</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={lbl}>Address Line 1</label>
            <input className={inputCls()} placeholder="123 Main St" value={billing.line1}
              onChange={e => setBilling(p => ({ ...p, line1: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Address Line 2 <span className="font-normal text-gray-400">(Optional)</span></label>
            <input className={inputCls()} placeholder="Suite 400" value={billing.line2}
              onChange={e => setBilling(p => ({ ...p, line2: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>City</label>
              <input className={inputCls()} placeholder="Los Angeles" value={billing.city}
                onChange={e => setBilling(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>ZIP Code</label>
              <input className={inputCls()} placeholder="90001" value={billing.zipCode}
                onChange={e => setBilling(p => ({ ...p, zipCode: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Country</label>
              <select className={inputCls()} value={billing.country}
                onChange={e => setBilling(p => ({ ...p, country: e.target.value, state: "" }))}>
                <option value="">Select Country</option>
                {allCountries.map(c => (
                  <option key={c.isoCode} value={c.isoCode}>{c.isoCode} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>State / Province</label>
              {billingStates.length > 0 ? (
                <select className={inputCls()} value={billing.state}
                  onChange={e => setBilling(p => ({ ...p, state: e.target.value }))}>
                  <option value="">Select State</option>
                  {billingStates.map(s => (
                    <option key={s.isoCode} value={s.isoCode}>{s.isoCode} — {s.name}</option>
                  ))}
                </select>
              ) : (
                <input className={inputCls()} placeholder="State / Province" value={billing.state}
                  onChange={e => setBilling(p => ({ ...p, state: e.target.value }))} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Shipping Address</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={lbl}>Address Line 1</label>
            <input className={inputCls()} placeholder="123 Main St" value={shipping.line1}
              onChange={e => setShipping(p => ({ ...p, line1: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Address Line 2 <span className="font-normal text-gray-400">(Optional)</span></label>
            <input className={inputCls()} placeholder="Suite 400" value={shipping.line2}
              onChange={e => setShipping(p => ({ ...p, line2: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>City</label>
              <input className={inputCls()} placeholder="Los Angeles" value={shipping.city}
                onChange={e => setShipping(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>ZIP Code</label>
              <input className={inputCls()} placeholder="90001" value={shipping.zipCode}
                onChange={e => setShipping(p => ({ ...p, zipCode: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Country</label>
              <select className={inputCls()} value={shipping.country}
                onChange={e => setShipping(p => ({ ...p, country: e.target.value, state: "" }))}>
                <option value="">Select Country</option>
                {allCountries.map(c => (
                  <option key={c.isoCode} value={c.isoCode}>{c.isoCode} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>State / Province</label>
              {shippingStates.length > 0 ? (
                <select className={inputCls()} value={shipping.state}
                  onChange={e => setShipping(p => ({ ...p, state: e.target.value }))}>
                  <option value="">Select State</option>
                  {shippingStates.map(s => (
                    <option key={s.isoCode} value={s.isoCode}>{s.isoCode} — {s.name}</option>
                  ))}
                </select>
              ) : (
                <input className={inputCls()} placeholder="State / Province" value={shipping.state}
                  onChange={e => setShipping(p => ({ ...p, state: e.target.value }))} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bank Details</p>
        <p className="text-xs text-gray-400 mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Required for withdrawal requests. Keep this up to date.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank Name"    name="bankName"        defaultValue={rep.bankName}        placeholder="e.g. Chase Bank" />
          <Field label="SWIFT (for International)" name="swiftCode" defaultValue={rep.swiftCode} placeholder="e.g. CHASUS33" />
          <div className="col-span-2">
            <Field label="Account Name" name="bankAccountName" defaultValue={rep.bankAccountName} placeholder="Name on account" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Account Number</label>
            <input
              type="text" name="bankAccountNumber" placeholder="Bank account number"
              value={accNum} onChange={(e) => onAccNumChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
                accNumError ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm Account Number</label>
            <input
              type="text" placeholder="Re-enter account number"
              value={confirmAccNum} onChange={(e) => onConfirmChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-colors ${
                accNumError ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white"
              }`}
            />
            {accNumError && <p className="text-xs text-red-500 mt-1">{accNumError}</p>}
          </div>
          <div className="col-span-2">
            <Field label="Routing Number" name="routingNumber" defaultValue={rep.routingNumber} placeholder="e.g. 021000021" />
          </div>
        </div>
      </div>

      <button
        type="submit" disabled={pending}
        className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
