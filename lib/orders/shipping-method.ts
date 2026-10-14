// The checkout shipping option the customer paid for, as named in WP admin.
// FedEx 2Day orders need a FedEx 2Day label; the name is matched loosely
// ("FedEx 2Day Shipping", "fedex 2 days", "Fedex 2-Day").
export function isFedEx2Day(method: string | null | undefined): boolean {
  return !!method && /fed\s*ex\s*2\s*-?\s*days?/i.test(method);
}
