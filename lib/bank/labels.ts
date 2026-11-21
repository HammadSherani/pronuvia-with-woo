// Bank account details shared by the doctor / rep account pages, the admin
// forms and Commission Payout: the choices, how they read, and when the
// details are complete enough for a payout.

export const BANK_ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Checking" },
  { value: "SAVINGS",  label: "Savings" },
] as const;

export const BANK_OWNERSHIP_TYPES = [
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Business" },
] as const;

export type BankAccountTypeValue   = (typeof BANK_ACCOUNT_TYPES)[number]["value"];
export type BankOwnershipTypeValue = (typeof BANK_OWNERSHIP_TYPES)[number]["value"];

export function bankAccountTypeLabel(v: string | null | undefined): string | null {
  return BANK_ACCOUNT_TYPES.find((o) => o.value === v)?.label ?? null;
}

export function bankOwnershipLabel(v: string | null | undefined): string | null {
  return BANK_OWNERSHIP_TYPES.find((o) => o.value === v)?.label ?? null;
}

/** A form value ("" = not chosen) as the enum, or undefined. */
export function parseBankAccountType(v: FormDataEntryValue | null): BankAccountTypeValue | undefined {
  return BANK_ACCOUNT_TYPES.find((o) => o.value === v)?.value;
}

export function parseBankOwnershipType(v: FormDataEntryValue | null): BankOwnershipTypeValue | undefined {
  return BANK_OWNERSHIP_TYPES.find((o) => o.value === v)?.value;
}

export type BankFields = {
  bankName?:          string | null;
  bankAccountNumber?: string | null;
  bankAccountName?:   string | null;
  bankAccountType?:   string | null;
  bankOwnershipType?: string | null;
};

/** Everything a payout needs (the same check the payout approval makes). */
export function bankDetailsComplete(u: BankFields | null | undefined): boolean {
  return Boolean(u?.bankName && u.bankAccountNumber && u.bankAccountName && u.bankAccountType && u.bankOwnershipType);
}

/** Some bank details are there, but not all a payout needs. */
export function bankDetailsPartial(u: BankFields | null | undefined): boolean {
  return Boolean(u?.bankName || u?.bankAccountNumber || u?.bankAccountName) && !bankDetailsComplete(u);
}
