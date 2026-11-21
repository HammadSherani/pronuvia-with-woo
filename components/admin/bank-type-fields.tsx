"use client";

import { BANK_ACCOUNT_TYPES, BANK_OWNERSHIP_TYPES } from "@/lib/bank/labels";

type Props = {
  className?:   string;
  labelClass:   string;
  selectClass:  string;
} & (
  // Controlled (the form keeps the values in state)
  | { accountType: string; onAccountType: (v: string) => void; ownership: string; onOwnership: (v: string) => void;
      defaultAccountType?: never; defaultOwnership?: never }
  // Uncontrolled
  | { defaultAccountType?: string; defaultOwnership?: string;
      accountType?: never; onAccountType?: never; ownership?: never; onOwnership?: never }
);

/**
 * "Account Type" (checking / savings) and "Personal or Business" selects for
 * the admin doctor and rep forms. Both are needed before a payout can be
 * approved; left empty here, the doctor or rep can fill them in themselves.
 */
export function BankTypeFields(p: Props) {
  const typeValue = p.onAccountType ? { value: p.accountType, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => p.onAccountType!(e.target.value) } : { defaultValue: p.defaultAccountType ?? "" };
  const ownValue  = p.onOwnership   ? { value: p.ownership,   onChange: (e: React.ChangeEvent<HTMLSelectElement>) => p.onOwnership!(e.target.value) }   : { defaultValue: p.defaultOwnership ?? "" };
  return (
    <div className={p.className}>
      <div>
        <label className={p.labelClass} htmlFor="bankAccountType">Account Type</label>
        <select id="bankAccountType" name="bankAccountType" className={p.selectClass} {...typeValue}>
          <option value="">Checking or savings</option>
          {BANK_ACCOUNT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className={p.labelClass} htmlFor="bankOwnershipType">Personal or Business</label>
        <select id="bankOwnershipType" name="bankOwnershipType" className={p.selectClass} {...ownValue}>
          <option value="">Personal or business</option>
          {BANK_OWNERSHIP_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
