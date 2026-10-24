// A user's saved address comes in two JSON shapes (plus legacy plain text):
//   - the rep / doctor's own account form (components/shared/address-fields):
//       { firstName, lastName, phone, address1, address2, city, state, zip, country }
//   - the admin sales-rep form: { line1, line2, city, zipCode, state, country }
// These helpers read either shape. No server-only imports: used by forms too.
// (lib/addresses/normalize.ts is the server-side version with code lookups.)

export type LineAddress = { line1: string; line2: string; city: string; zipCode: string; country: string; state: string };
export type Address1Shape = {
  firstName?: string; lastName?: string; phone?: string;
  address1?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string;
};

const s = (v: unknown) => (typeof v === "string" ? v : "");

function parse(raw: string | null | undefined): { shape: "address1" | "line1" | "text" | "empty"; j: Record<string, unknown>; text: string } {
  const text = raw?.trim() ?? "";
  if (!text) return { shape: "empty", j: {}, text };
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object") {
      if ("address1" in j || "zip" in j) return { shape: "address1", j, text };
      if ("line1" in j || "zipCode" in j) return { shape: "line1", j, text };
    }
  } catch { /* plain text */ }
  return { shape: "text", j: {}, text };
}

/** For the admin sales-rep form: { line1, line2, city, zipCode, country, state }. */
export function toLineAddress(raw: string | null | undefined): LineAddress {
  const { shape, j, text } = parse(raw);
  if (shape === "address1") return { line1: s(j.address1), line2: s(j.address2), city: s(j.city), zipCode: s(j.zip), country: s(j.country), state: s(j.state) };
  if (shape === "line1")    return { line1: s(j.line1), line2: s(j.line2), city: s(j.city), zipCode: s(j.zipCode), country: s(j.country), state: s(j.state) };
  return { line1: text, line2: "", city: "", zipCode: "", country: "", state: "" };
}

/** For the account form (migrateAddressData): { address1, address2, city, state, zip, country, … }. */
export function toAddress1Shape(raw: string | null | undefined): Address1Shape {
  const { shape, j, text } = parse(raw);
  if (shape === "address1") return j as Address1Shape;
  if (shape === "line1") return { address1: s(j.line1), address2: s(j.line2), city: s(j.city), state: s(j.state), zip: s(j.zipCode), country: s(j.country) };
  return text ? { address1: text } : {};
}

/** Display: street lines, "city, state, zip", country — one per line. */
export function formatAddressLines(raw: string | null | undefined): string {
  const { shape, text } = parse(raw);
  if (shape === "text" || shape === "empty") return text;
  const a = toLineAddress(raw);
  return [a.line1, a.line2, [a.city, a.state, a.zipCode].filter(Boolean).join(", "), a.country].filter(Boolean).join("\n");
}
