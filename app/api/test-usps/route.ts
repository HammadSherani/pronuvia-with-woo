import { NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";

const BASE = process.env.USPS_BASE_URL ?? "https://api.usps.com";

async function uspsPost(token: string, body: object) {
  const res = await fetch(`${BASE}/prices/v3/total-rates/search`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    cache:   "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

export async function GET() {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const clientId     = process.env.USPS_CLIENT_ID     ?? "";
  const clientSecret = process.env.USPS_CLIENT_SECRET ?? "";

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing USPS credentials" }, { status: 500 });
  }

  // Step 1: Auth
  const tokenRes = await fetch(`${BASE}/oauth2/v3/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    cache:   "no-store",
  });
  if (!tokenRes.ok) {
    const e = await tokenRes.text();
    return NextResponse.json({ base: BASE, auth: "FAILED", error: e }, { status: 500 });
  }
  const { access_token: token } = await tokenRes.json() as { access_token: string };

  // Step 2: Try multiple scenarios to isolate where USPS rates fail
  const origin = (process.env.SHIP_FROM_ZIP ?? "11358").slice(0, 5);
  // NOTE: USPS Prices API v3 takes weight in POUNDS (integer), not ounces
  const scenarios = [
    // ── Small MACHINABLE ─────────────────────────────────────────────────────
    { label: "1lb_machinable_dc",    dest: "20260", weight: 1,  l: 8,  w: 6,  h: 4,  cat: "MACHINABLE", svc: "USPS_GROUND_ADVANTAGE" },
    { label: "1lb_machinable_ca",    dest: "94043", weight: 1,  l: 8,  w: 6,  h: 4,  cat: "MACHINABLE", svc: "USPS_GROUND_ADVANTAGE" },
    // ── Medium ───────────────────────────────────────────────────────────────
    { label: "20lb_machinable_dc",   dest: "20260", weight: 20, l: 9,  w: 9,  h: 9,  cat: "MACHINABLE", svc: "USPS_GROUND_ADVANTAGE" },
    { label: "20lb_irregular_dc",    dest: "20260", weight: 20, l: 9,  w: 9,  h: 9,  cat: "IRREGULAR",  svc: "USPS_GROUND_ADVANTAGE" },
    // ── Heavy (matches real orders) ──────────────────────────────────────────
    { label: "44lb_irregular_dc",    dest: "20260", weight: 44, l: 21, w: 21, h: 21, cat: "IRREGULAR",  svc: "USPS_GROUND_ADVANTAGE" },
    { label: "44lb_irregular_ca",    dest: "94043", weight: 44, l: 21, w: 21, h: 21, cat: "IRREGULAR",  svc: "USPS_GROUND_ADVANTAGE" },
    { label: "44lb_priority_dc",     dest: "20260", weight: 44, l: 21, w: 21, h: 21, cat: "IRREGULAR",  svc: "PRIORITY_MAIL" },
  ];

  const results: Record<string, unknown> = {};
  for (const s of scenarios) {
    const r = await uspsPost(token, {
      originZIPCode:               origin,
      destinationZIPCode:          s.dest,
      weight:                      s.weight,
      length:                      s.l,
      width:                       s.w,
      height:                      s.h,
      mailClass:                   s.svc,
      processingCategory:          s.cat,
      destinationEntryFacilityType:"NONE",
      rateIndicator:               "SP",
      priceType:                   "RETAIL",
    });
    // Summarise to keep response compact
    results[s.label] = r.status === 200
      ? { ok: true, price: (r.body as { rateOptions?: Array<{ totalBasePrice: number }> })?.rateOptions?.[0]?.totalBasePrice }
      : { ok: false, status: r.status, code: (r.body as { error?: { errors?: Array<{ code: string }> } })?.error?.errors?.[0]?.code };
  }

  return NextResponse.json({ base: BASE, origin, results });
}
