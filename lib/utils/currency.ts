// Shared USD currency formatter — always renders two decimal places with
// thousands separators (e.g. 1420 -> "$1,420.00"), matching the storefront's
// expected price display everywhere money is shown.
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
