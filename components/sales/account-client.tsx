"use client";

import { useActionState, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSalesRepProfile, type ProfileState } from "@/actions/sales-rep/profile";
import { AddressFields, migrateAddressData, type AddressData, EMPTY_ADDRESS } from "@/components/shared/address-fields";
import { formatDateLong } from "@/lib/utils/timezone";

type Rep = {
  firstName: string; lastName: string; name: string; email: string;
  phone: string | null; website: string | null;
  commission: number; walletBalance: number; ordersCount: number;
  billingAddress: string | null; shippingAddress: string | null;
  bankName: string | null; bankAccountName: string | null;
  bankAccountNumber: string | null; bankAccountType: string | null; bankOwnershipType: string | null;
  swiftCode: string | null; routingNumber: string | null;
  createdAt: Date;
  _count: { physicians: number };
};

const inp    = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/30 transition bg-white disabled:bg-gray-50 disabled:text-gray-400";
const inpErr = "w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300 transition bg-white";
const lbl    = "block text-xs font-semibold text-gray-500 mb-1";

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="py-3 border-b border-gray-50 last:border-0 flex flex-col sm:flex-row sm:items-start gap-1">
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-44 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">
        {value !== null && value !== undefined && value !== ""
          ? String(value)
          : <span className="text-gray-300 italic text-xs">Not provided</span>}
      </dd>
    </div>
  );
}

type AddrObj = { line1?: string; line2?: string; city?: string; state?: string; zipCode?: string; country?: string };
function parseAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const a: AddrObj = JSON.parse(raw);
    return [
      a.line1, a.line2,
      [a.city, a.state, a.zipCode].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean).join("\n");
  } catch { return raw; }
}

function AddressRow({ label, raw }: { label: string; raw?: string | null }) {
  const formatted = parseAddress(raw);
  return (
    <div className="py-3 border-b border-gray-50 last:border-0 flex flex-col sm:flex-row sm:items-start gap-1">
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-44 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
        {formatted || <span className="text-gray-300 italic text-xs">Not provided</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <dl className="px-6 py-1">{children}</dl>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── View mode ────────────────────────────────────────────────────────────────

function ViewMode({ r, onEdit }: { r: Rep; onEdit: () => void }) {
  const memberSince = formatDateLong(r.createdAt);

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3DBFA4] to-[#2a8f7a] flex items-center justify-center shrink-0 text-white text-2xl font-black select-none">
          {r.firstName.charAt(0)}{r.lastName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-gray-900">{r.name}</p>
          <p className="text-sm text-gray-400">{r.email}</p>
          <p className="text-xs text-gray-300 mt-0.5">Member since {memberSince}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
            {r.commission}% commission
          </span>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4L14.768 1.768a2 2 0 012.828 0l1.636 1.636a2 2 0 010 2.828L9 13z" />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Wallet Balance",      value: fmt(r.walletBalance), color: "#3DBFA4" },
          { label: "Total Orders",         value: String(r.ordersCount), color: "#5BB8D4" },
          { label: "Downline Physicians",  value: String(r._count.physicians), color: "#8b5cf6" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="w-8 h-1 rounded-full mb-3" style={{ background: color }} />
            <p className="text-xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <Section title="Personal Information">
        <InfoRow label="First Name" value={r.firstName} />
        <InfoRow label="Last Name"  value={r.lastName} />
        <InfoRow label="Email"      value={r.email} />
        <InfoRow label="Phone"      value={r.phone} />
        <InfoRow label="Website"    value={r.website} />
      </Section>

      <Section title="Addresses">
        <AddressRow label="Billing Address"  raw={r.billingAddress} />
        <AddressRow label="Shipping Address" raw={r.shippingAddress} />
      </Section>

      <Section title="Bank Details">
        <InfoRow label="Bank Name"      value={r.bankName} />
        <InfoRow label="Account Name"   value={r.bankAccountName} />
        <InfoRow label="Account Number" value={r.bankAccountNumber} />
        <InfoRow label="Account Type" value={r.bankAccountType} />
        <InfoRow label="Personal / Business" value={r.bankOwnershipType} />
        <InfoRow label="SWIFT (for International)" value={r.swiftCode} />
        <InfoRow label="Routing Number" value={r.routingNumber} />
      </Section>
    </div>
  );
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

function EditMode({ r, onCancel }: { r: Rep; onCancel: () => void }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateSalesRepProfile, undefined);
  const router = useRouter();

  const [accNum,       setAccNum]       = useState(r.bankAccountNumber ?? "");
  const [confirm,      setConfirm]      = useState(r.bankAccountNumber ?? "");
  const [mismatch,     setMismatch]     = useState(false);

  const parseAddr = (raw: string | null): AddressData =>
    raw ? migrateAddressData((() => { try { return JSON.parse(raw); } catch { return {}; } })()) : { ...EMPTY_ADDRESS };

  const [billingAddr,  setBillingAddr]  = useState<AddressData>(() => parseAddr(r.billingAddress));
  const [shippingAddr, setShippingAddr] = useState<AddressData>(() => parseAddr(r.shippingAddress));

  function onAccChange(val: string) {
    setAccNum(val);
    setMismatch(confirm.length > 0 && val !== confirm);
  }
  function onConfirmChange(val: string) {
    setConfirm(val);
    setMismatch(val !== accNum);
  }

  const errs = state?.errors ?? {};

  useEffect(() => {
    if (state?.success) {
      onCancel();
      router.refresh();
    }
  }, [state, onCancel, router]);

  return (
    <form action={action} className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-sm text-gray-400 mt-0.5">Update your details and bank information</p>
        </div>
        <button type="button" onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors">
          Cancel
        </button>
      </div>

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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 border-b border-gray-100">Personal Info</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" error={errs.firstName?.[0]}>
            <input name="firstName" defaultValue={r.firstName}
              className={errs.firstName ? inpErr : inp} />
          </Field>
          <Field label="Last Name" error={errs.lastName?.[0]}>
            <input name="lastName" defaultValue={r.lastName}
              className={errs.lastName ? inpErr : inp} />
          </Field>
          <Field label="Email (read-only)">
            <input value={r.email} disabled className={inp} />
          </Field>
          <Field label="Phone" error={errs.phone?.[0]}>
            <input name="phone" defaultValue={r.phone ?? ""} placeholder="+1 (555) 000-0000"
              className={errs.phone ? inpErr : inp} />
          </Field>
          <div className="col-span-2">
            <Field label="Website" error={errs.website?.[0]}>
              <input name="website" type="url" defaultValue={r.website ?? ""} placeholder="https://yoursite.com"
                className={errs.website ? inpErr : inp} />
            </Field>
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 border-b border-gray-100">Addresses</p>
        {/* Hidden inputs carry the JSON to the server action */}
        <input type="hidden" name="billingAddress"  value={JSON.stringify(billingAddr)} />
        <input type="hidden" name="shippingAddress" value={JSON.stringify(shippingAddr)} />

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-3">Billing Address</p>
          <AddressFields value={billingAddr} onChange={setBillingAddr} showName={false} />
        </div>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3">Shipping Address</p>
          <AddressFields value={shippingAddr} onChange={setShippingAddr} showName={false} />
        </div>
      </div>

      {/* Bank details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="pb-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bank Details</p>
          <p className="text-xs text-gray-400 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Required for withdrawal requests. Keep this up to date.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank Name">
            <input name="bankName" defaultValue={r.bankName ?? ""} placeholder="e.g. Chase Bank" className={inp} />
          </Field>
          <Field label="SWIFT (for International)">
            <input name="swiftCode" defaultValue={r.swiftCode ?? ""} placeholder="e.g. CHASUS33" className={inp} />
          </Field>
          <div className="col-span-2">
            <Field label="Account Name">
              <input name="bankAccountName" defaultValue={r.bankAccountName ?? ""} placeholder="Name on account" className={inp} />
            </Field>
          </div>
          <Field label="Account Number">
            <input
              name="bankAccountNumber"
              value={accNum}
              onChange={(e) => onAccChange(e.target.value)}
              placeholder="Bank account number"
              className={mismatch ? inpErr : inp}
            />
          </Field>
          <Field label="Confirm Account Number" error={mismatch ? "Account numbers do not match" : undefined}>
            <input
              value={confirm}
              onChange={(e) => onConfirmChange(e.target.value)}
              placeholder="Re-enter account number"
              className={mismatch ? inpErr : inp}
            />
          </Field>
          <Field label="Account Type *">
            <select name="bankAccountType" required defaultValue={r.bankAccountType ?? ""} className={inp}>
              <option value="">Select checking or savings</option>
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </Field>
          <Field label="Personal or Business *">
            <select name="bankOwnershipType" required defaultValue={r.bankOwnershipType ?? ""} className={inp}>
              <option value="">Select personal or business</option>
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Routing Number">
              <input name="routingNumber" defaultValue={r.routingNumber ?? ""} placeholder="e.g. 021000021" className={inp} />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-300 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending || mismatch}
          className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function SalesAccountClient({ rep }: { rep: Rep }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="">
      {!editing && (
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Account</h1>
          <p className="text-sm text-gray-400 mt-0.5">View your profile and account details</p>
        </div>
      )}
      {editing
        ? <EditMode r={rep} onCancel={() => setEditing(false)} />
        : <ViewMode r={rep} onEdit={() => setEditing(true)} />
      }
    </div>
  );
}
