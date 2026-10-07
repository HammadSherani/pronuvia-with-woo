"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updatePhysicianBankDetails } from "@/actions/physician/update-profile";
import { updateSalesRepBankDetails } from "@/actions/sales-rep/profile";
import type { UpdateProfileState } from "@/actions/physician/update-profile";

const inp    = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/30 transition bg-white";
const inpErr = "w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300 transition bg-white";
const lbl    = "block text-xs font-semibold text-gray-500 mb-1";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function BankNotifyGate({ role }: { role: "PHYSICIAN" | "SALES_REP" }) {
  const router = useRouter();
  const action = role === "PHYSICIAN" ? updatePhysicianBankDetails : updateSalesRepBankDetails;
  const [state, formAction, pending] = useActionState<UpdateProfileState, FormData>(action, undefined);

  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [accountMismatch, setAccountMismatch] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? "Bank details saved.");
      router.refresh();
    } else if (state.errors) {
      const firstError = Object.values(state.errors).flat()[0];
      if (firstError) toast.error(firstError);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  const e = state?.errors ?? {};

  function handleAccountChange(val: string) {
    setAccountNumber(val);
    setAccountMismatch(confirmAccountNumber.length > 0 && val !== confirmAccountNumber);
  }

  function handleConfirmChange(val: string) {
    setConfirmAccountNumber(val);
    setAccountMismatch(val !== accountNumber);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 my-auto">

        {/* Icon */}
        <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Bank Account Required</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed text-center">
          Your commission is ready but we need your bank account details to process your payout.
          Add your bank information below to continue using the portal.
        </p>

        <form action={formAction} className="space-y-4">
          <Field label="Bank Name *" error={e.bankName?.[0]}>
            <input name="bankName" required placeholder="e.g. Chase Bank" className={e.bankName ? inpErr : inp} />
          </Field>

          <Field label="Account Holder Name *" error={e.bankAccountName?.[0]}>
            <input name="bankAccountName" required placeholder="Name on account" className={e.bankAccountName ? inpErr : inp} />
          </Field>

          <Field label="Account Number *" error={e.bankAccountNumber?.[0]}>
            <input
              name="bankAccountNumber"
              required
              value={accountNumber}
              onChange={(ev) => handleAccountChange(ev.target.value)}
              placeholder="Account number"
              className={e.bankAccountNumber ? inpErr : inp}
            />
          </Field>

          <Field label="Confirm Account Number *" error={accountMismatch ? "Account numbers do not match" : undefined}>
            <input
              required
              value={confirmAccountNumber}
              onChange={(ev) => handleConfirmChange(ev.target.value)}
              placeholder="Re-enter account number"
              className={accountMismatch ? inpErr : inp}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Type *" error={e.bankAccountType?.[0]}>
              <select name="bankAccountType" required className={e.bankAccountType ? inpErr : inp} defaultValue="">
                <option value="">Select type</option>
                <option value="CHECKING">Checking</option>
                <option value="SAVINGS">Savings</option>
              </select>
            </Field>
            <Field label="Personal or Business *" error={e.bankOwnershipType?.[0]}>
              <select name="bankOwnershipType" required className={e.bankOwnershipType ? inpErr : inp} defaultValue="">
                <option value="">Select type</option>
                <option value="PERSONAL">Personal</option>
                <option value="BUSINESS">Business</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SWIFT (for International)">
              <input name="swiftCode" placeholder="e.g. CHASUS33" className={inp} />
            </Field>
            <Field label="Routing Number">
              <input name="routingNumber" placeholder="e.g. 021000021" className={inp} />
            </Field>
          </div>

          <button
            type="submit"
            disabled={pending || accountMismatch}
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#3DBFA4] hover:bg-[#2ea88f] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {pending && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {pending ? "Saving…" : "Save Bank Details"}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 mt-4 text-center">
          This prompt will disappear once your bank details are saved.
        </p>
      </div>
    </div>
  );
}
