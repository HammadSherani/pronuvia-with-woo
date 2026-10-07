"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updatePhysicianProfile, type UpdateProfileState } from "@/actions/physician/update-profile";
import { AddressFields, type AddressData, EMPTY_ADDRESS } from "@/components/shared/address-fields";
import { State, Country } from "country-state-city";
import { formatDateLong } from "@/lib/utils/timezone";

const SPECIALTIES = [
  "Cardiology","Dermatology","Endocrinology","Family Medicine","Gastroenterology",
  "General Practice","Internal Medicine","Neurology","Obstetrics & Gynecology",
  "Oncology","Ophthalmology","Orthopedics","Pediatrics","Psychiatry",
  "Pulmonology","Radiology","Rheumatology","Surgery","Urology",
];

type Physician = {
  firstName: string; lastName: string; email: string; loginId: string | null;
  phone: string | null; officeContactNumber: string | null; fax: string | null;
  nameOfPractice: string | null; license: string | null;
  yearsInPractice: number | null; aictherapy: string | null;
  credential: string | null; patientsPerMonth: number | null;
  websiteLink: string | null; fieldsOfSpeciality: string[];
  addressOne: string | null; addressTwo: string | null;
  city: string | null; state: string | null; zipCode: string | null;
  bankName: string | null; bankAccountName: string | null;
  bankAccountNumber: string | null; bankAccountType: string | null; bankOwnershipType: string | null;
  swiftCode: string | null; routingNumber: string | null;
  commission: number; uplineCommission: number;
  isApproved: "APPROVED" | "PENDING" | "REJECTED";
  createdAt: Date;
};

const inp    = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/30 transition bg-white disabled:bg-gray-50 disabled:text-gray-400";
const inpErr = "w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300 transition bg-white";
const lbl    = "block text-xs font-semibold text-gray-500 mb-1";

const statusStyle = {
  APPROVED: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Approved" },
  PENDING:  { cls: "bg-amber-50  text-amber-700  border-amber-200",  label: "Pending Approval" },
  REJECTED: { cls: "bg-red-50    text-red-700    border-red-200",    label: "Rejected" },
};

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

function ViewMode({ p, onEdit }: { p: Physician; onEdit: () => void }) {
  const status = statusStyle[p.isApproved];
  const fullAddress = [p.addressOne, p.addressTwo, p.city, p.state, p.zipCode].filter(Boolean).join(", ");
  const memberSince = formatDateLong(p.createdAt);

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5BB8D4] to-[#3a90a8] flex items-center justify-center shrink-0 text-white text-2xl font-black select-none">
          {p.firstName.charAt(0)}{p.lastName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-gray-900"> {p.firstName} {p.lastName}</p>
          <p className="text-sm text-gray-400">{p.email}</p>
          {p.loginId && <p className="text-xs text-gray-400 mt-0.5">Login ID: {p.loginId}</p>}
          {p.nameOfPractice && <p className="text-xs text-gray-400 mt-0.5">{p.nameOfPractice}</p>}
          <p className="text-xs text-gray-300 mt-0.5">Member since {memberSince}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className={`inline-flex px-3 py-1 border rounded-full text-xs font-semibold ${status.cls}`}>
            {status.label}
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

      {p.isApproved === "PENDING" && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Account Pending Approval</p>
            <p className="text-xs text-amber-600 mt-0.5">Your registration is under review. You will be notified once approved.</p>
          </div>
        </div>
      )}

      <Section title="Personal Information">
        <InfoRow label="First Name"      value={p.firstName} />
        <InfoRow label="Last Name"       value={p.lastName} />
        <InfoRow label="Email"           value={p.email} />
        <InfoRow label="Login ID"        value={p.loginId} />
        <InfoRow label="Phone"           value={p.phone} />
        <InfoRow label="Office Contact"  value={p.officeContactNumber} />
        <InfoRow label="Fax"             value={p.fax} />
      </Section>

      <Section title="Practice Information">
        <InfoRow label="Practice Name"     value={p.nameOfPractice} />
        <InfoRow label="License Number"    value={p.license} />
        <InfoRow label="Years in Practice" value={p.yearsInPractice} />
        <InfoRow label="Credential"        value={p.credential} />
        <InfoRow label="Patients Seen Per Month" value={p.patientsPerMonth} />
        <InfoRow label="How did you hear about AIC Therapy?" value={p.aictherapy} />
        <InfoRow label="Website"           value={p.websiteLink} />
        <InfoRow label="Specialties"       value={p.fieldsOfSpeciality?.join(", ")} />
        <InfoRow label="Address"           value={fullAddress || null} />
      </Section>

      <Section title="Bank Details">
        <InfoRow label="Bank Name"       value={p.bankName} />
        <InfoRow label="Account Name"    value={p.bankAccountName} />
        <InfoRow label="Account Number"  value={p.bankAccountNumber} />
        <InfoRow label="Account Type"    value={p.bankAccountType} />
        <InfoRow label="Personal / Business" value={p.bankOwnershipType} />
        <InfoRow label="SWIFT (for International)" value={p.swiftCode} />
        <InfoRow label="Routing Number"  value={p.routingNumber} />
      </Section>

      <Section title="Commission">
        <InfoRow label="Commission Rate"        value={`${p.commission}%`} />
        {/* <InfoRow label="Upline Commission Rate" value={`${p.uplineCommission}%`} /> */}
      </Section>

    </div>
  );
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

function EditMode({ p, onCancel }: { p: Physician; onCancel: () => void }) {
  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(updatePhysicianProfile, undefined);
  const router = useRouter();
  const [specialties, setSpecialties] = useState<string[]>(p.fieldsOfSpeciality ?? []);
  const [accountNumber, setAccountNumber]         = useState(p.bankAccountNumber ?? "");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(p.bankAccountNumber ?? "");
  const [accountMismatch, setAccountMismatch]     = useState(false);

  const [addrData, setAddrData] = useState<AddressData>(() => {
    const stateCode = p.state ?? "";
    const stateList = State.getStatesOfCountry("US");
    const stObj = stateList.find(s => s.isoCode === stateCode.toUpperCase()) ?? stateList.find(s => s.name.toLowerCase() === stateCode.toLowerCase());
    const country = Country.getCountryByCode("US");
    return {
      ...EMPTY_ADDRESS,
      address1:    p.addressOne  ?? "",
      address2:    p.addressTwo  ?? "",
      city:        p.city        ?? "",
      state:       stObj?.isoCode ?? stateCode,
      stateName:   stObj?.name    ?? stateCode,
      zip:         p.zipCode     ?? "",
      country:     "US",
      countryName: country?.name ?? "United States",
    };
  });

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? "Profile updated successfully.");
      onCancel();
      router.refresh();
    } else if (state.errors) {
      const firstError = Object.values(state.errors).flat()[0];
      if (firstError) toast.error(firstError);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onCancel, router]);

  const e = state?.errors ?? {};

  function toggle(s: string) {
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function handleAccountChange(val: string) {
    setAccountNumber(val);
    setAccountMismatch(confirmAccountNumber.length > 0 && val !== confirmAccountNumber);
  }

  function handleConfirmChange(val: string) {
    setConfirmAccountNumber(val);
    setAccountMismatch(val !== accountNumber);
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="fieldsOfSpeciality" value={JSON.stringify(specialties)} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-sm text-gray-400 mt-0.5">Email cannot be changed</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} disabled={pending}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={pending || accountMismatch}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg disabled:opacity-50 transition-colors">
            {pending && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {state?.message && !state.success && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{state.message}</div>
      )}
      {state?.success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {state.message}
        </div>
      )}

      {/* ── Personal Information ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 pb-3 border-b border-gray-100">Personal Information</h2>

        {/* Email — read only */}
        <div>
          <label className={lbl}>Email <span className="text-gray-300 font-normal">(cannot be changed)</span></label>
          <input value={p.email} disabled className={inp} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name *" error={e.firstName?.[0]}>
            <input name="firstName" required defaultValue={p.firstName} className={e.firstName ? inpErr : inp} />
          </Field>
          <Field label="Last Name *" error={e.lastName?.[0]}>
            <input name="lastName" required defaultValue={p.lastName} className={e.lastName ? inpErr : inp} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone *" error={e.phone?.[0]}>
            <input name="phone" required defaultValue={p.phone ?? ""} className={e.phone ? inpErr : inp} />
          </Field>
          <Field label="Office Contact *" error={e.officeContactNumber?.[0]}>
            <input name="officeContactNumber" required defaultValue={p.officeContactNumber ?? ""} className={e.officeContactNumber ? inpErr : inp} />
          </Field>
        </div>

        <Field label="Fax *" error={e.fax?.[0]}>
          <input name="fax" required defaultValue={p.fax ?? ""} className={e.fax ? inpErr : inp} />
        </Field>
      </div>

      {/* ── Practice Information ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 pb-3 border-b border-gray-100">Practice Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Practice Name *" error={e.nameOfPractice?.[0]}>
            <input name="nameOfPractice" required defaultValue={p.nameOfPractice ?? ""} className={e.nameOfPractice ? inpErr : inp} />
          </Field>
          <Field label="License Number *" error={e.license?.[0]}>
            <input name="license" required defaultValue={p.license ?? ""} className={e.license ? inpErr : inp} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Years in Practice *" error={e.yearsInPractice?.[0]}>
            <input name="yearsInPractice" type="number" min="0" required defaultValue={p.yearsInPractice ?? ""} className={e.yearsInPractice ? inpErr : inp} />
          </Field>
          <Field label="How did you hear about AIC Therapy? *" error={e.aictherapy?.[0]}>
            <input name="aictherapy" required defaultValue={p.aictherapy ?? ""} className={e.aictherapy ? inpErr : inp} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Credential (Optional)" error={e.credential?.[0]}>
            <input name="credential" placeholder="e.g. MD, DO, DC, ND, RN" defaultValue={p.credential ?? ""} className={e.credential ? inpErr : inp} />
          </Field>
          <Field label="Patients Seen Per Month (Optional)" error={e.patientsPerMonth?.[0]}>
            <input name="patientsPerMonth" type="number" min="0" defaultValue={p.patientsPerMonth ?? ""} className={e.patientsPerMonth ? inpErr : inp} />
          </Field>
        </div>

        <Field label="Website" error={e.websiteLink?.[0]}>
          <input name="websiteLink" type="url" defaultValue={p.websiteLink ?? ""} className={e.websiteLink ? inpErr : inp} />
        </Field>

        {/* Specialties */}
        <div>
          <label className={lbl}>Fields of Specialties *</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {SPECIALTIES.map((s) => (
              <button key={s} type="button" onClick={() => toggle(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  specialties.includes(s)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-900"
                }`}>
                {s}
              </button>
            ))}
          </div>
          {(e as Record<string, string[]>).fieldsOfSpeciality?.[0] && (
            <p className="text-xs text-red-500 mt-1">{(e as Record<string, string[]>).fieldsOfSpeciality[0]}</p>
          )}
          {specialties.length > 0 && (
            <p className="text-xs text-[#3DBFA4] mt-2">{specialties.length} selected</p>
          )}
        </div>
      </div>

      {/* ── Address ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 pb-3 border-b border-gray-100">Address</h2>
        {/* Hidden inputs map AddressFields state → server action fields */}
        <input type="hidden" name="addressOne" value={addrData.address1} />
        <input type="hidden" name="addressTwo" value={addrData.address2} />
        <input type="hidden" name="city"       value={addrData.city} />
        <input type="hidden" name="state"      value={addrData.state} />
        <input type="hidden" name="zipCode"    value={addrData.zip} />
        {(e.addressOne ?? e.city ?? e.state ?? e.zipCode) && (
          <p className="text-xs text-red-500">{e.addressOne?.[0] ?? e.city?.[0] ?? e.state?.[0] ?? e.zipCode?.[0]}</p>
        )}
        <AddressFields value={addrData} onChange={setAddrData} showName={false} showPhone={false} />
      </div>

      {/* ── Bank Details ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 pb-3 border-b border-gray-100">Bank Details</h2>
        <p className="text-xs text-gray-400">Used for commission payouts. All fields are optional.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Bank Name">
            <input name="bankName" defaultValue={p.bankName ?? ""} placeholder="e.g. Chase Bank" className={inp} />
          </Field>
          <Field label="Account Holder Name">
            <input name="bankAccountName" defaultValue={p.bankAccountName ?? ""} placeholder="Name on account" className={inp} />
          </Field>
        </div>

        <Field label="Account Number">
          <input
            name="bankAccountNumber"
            value={accountNumber}
            onChange={(ev) => handleAccountChange(ev.target.value)}
            placeholder="Account number"
            className={inp}
          />
        </Field>

        <Field
          label="Confirm Account Number"
          error={accountMismatch ? "Account numbers do not match" : undefined}
        >
          <input
            value={confirmAccountNumber}
            onChange={(ev) => handleConfirmChange(ev.target.value)}
            placeholder="Re-enter account number"
            className={accountMismatch ? inpErr : inp}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Account Type *" error={e.bankAccountType?.[0]}>
            <select name="bankAccountType" required defaultValue={p.bankAccountType ?? ""} className={e.bankAccountType ? inpErr : inp}>
              <option value="">Select checking or savings</option>
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </Field>
          <Field label="Personal or Business *" error={e.bankOwnershipType?.[0]}>
            <select name="bankOwnershipType" required defaultValue={p.bankOwnershipType ?? ""} className={e.bankOwnershipType ? inpErr : inp}>
              <option value="">Select personal or business</option>
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>
          </Field>
        </div>

        <Field label="SWIFT (for International)">
          <input name="swiftCode" defaultValue={p.swiftCode ?? ""} placeholder="e.g. CHASUS33" className={inp} />
        </Field>

        <Field label="Routing Number">
          <input name="routingNumber" defaultValue={p.routingNumber ?? ""} placeholder="e.g. 021000021" className={inp} />
        </Field>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg disabled:opacity-50 transition-colors">
          {pending && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function PhysicianAccountClient({ physician }: { physician: Physician }) {
  const [editing, setEditing] = useState(false);

  return editing
    ? <EditMode p={physician} onCancel={() => setEditing(false)} />
    : <ViewMode p={physician} onEdit={() => setEditing(true)} />;
}
