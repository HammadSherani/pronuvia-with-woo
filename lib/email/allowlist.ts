// Test-site email guard. With EMAIL_ALLOWLIST set (Vercel → Environment
// Variables), email only goes to the addresses on it; every other recipient
// is dropped and the send is logged as BLOCKED on the Email Log page, so a
// test can't reach a real doctor. Entries are separated by commas / spaces:
// a full address (info@aictherapy.com) or a whole domain (@pronuvia.com).
// Not set (production) → no restriction.

function entries(): string[] {
  return (process.env.EMAIL_ALLOWLIST ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function emailAllowlistActive(): boolean {
  return entries().length > 0;
}

export function isEmailAllowed(address: string): boolean {
  const list = entries();
  if (!list.length) return true;
  const a = address.trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1");
  return list.some((e) => (e.startsWith("@") ? a.endsWith(e) : a === e));
}

/**
 * The recipients this email may go to. When the main recipient is blocked but
 * a CC is allowed (e.g. the admin copy), that CC becomes the main recipient.
 * `to` is null when nobody on the email is allowed.
 */
export function allowedRecipients(to: string, cc: string[], bcc: string[]) {
  const okCc = cc.filter(isEmailAllowed), okBcc = bcc.filter(isEmailAllowed);
  const blocked = [to, ...cc, ...bcc].filter((a) => a && !isEmailAllowed(a));
  if (isEmailAllowed(to)) return { to, cc: okCc, bcc: okBcc, blocked };
  const [first, ...rest] = [...okCc, ...okBcc];
  return first
    ? { to: first, cc: rest.filter((a) => okCc.includes(a)), bcc: rest.filter((a) => okBcc.includes(a)), blocked }
    : { to: null, cc: [], bcc: [], blocked };
}
