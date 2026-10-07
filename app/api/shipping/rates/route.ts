import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";

const FEDEX_URL =
  process.env.FEDEX_API_URL ?? "https://apis-sandbox.fedex.com";

// ── OAuth token (best-effort in-process cache) ────────────────────────────────

let _token: string | null = null;
let _tokenExp = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExp - 30_000) return _token;

  const clientId     = process.env.FEDEX_CLIENT_ID     ?? "";
  const clientSecret = process.env.FEDEX_CLIENT_SECRET ?? "";

  if (!clientId || !clientSecret) {
    throw new Error("FEDEX_CLIENT_ID or FEDEX_CLIENT_SECRET env var is missing.");
  }

  const res = await fetch(`${FEDEX_URL}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FedEx auth failed (${res.status}): ${text}`);
  }

  let data: { access_token: string; expires_in?: number };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`FedEx auth returned non-JSON: ${text}`);
  }

  if (!data.access_token) {
    throw new Error(`FedEx auth: no access_token in response: ${text}`);
  }

  _token    = data.access_token;
  _tokenExp = Date.now() + (data.expires_in ?? 3600) * 1000;
  return _token;
}

// ── Rate request ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  // 1. Validate env vars up-front so we get a clear error
  const missingVars: string[] = [];
  if (!process.env.FEDEX_CLIENT_ID)      missingVars.push("FEDEX_CLIENT_ID");
  if (!process.env.FEDEX_CLIENT_SECRET)  missingVars.push("FEDEX_CLIENT_SECRET");
  if (!process.env.FEDEX_ACCOUNT_NUMBER) missingVars.push("FEDEX_ACCOUNT_NUMBER");
  if (!process.env.FEDEX_SHIPPER_ZIP)    missingVars.push("FEDEX_SHIPPER_ZIP");
  if (missingVars.length > 0) {
    return NextResponse.json(
      { error: `Missing env vars: ${missingVars.join(", ")}` },
      { status: 500 }
    );
  }

  try {
    const { destination, totalWeightLb = 1 } = (await req.json()) as {
      destination: {
        address1:  string;
        address2?: string;
        city:      string;
        state:     string;
        zip:       string;
        country:   string;
      };
      totalWeightLb?: number;
    };

    if (!destination?.city || !destination?.zip) {
      return NextResponse.json(
        { error: "Destination address incomplete (need city + zip)." },
        { status: 400 }
      );
    }

    // 2. Get OAuth token
    const token = await getToken();

    // 3. Build rate request
    const streetLines = [destination.address1, destination.address2]
      .filter(Boolean) as string[];

    const requestBody = {
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: {
          address: {
            streetLines:         [process.env.FEDEX_SHIPPER_ADDRESS ?? "1 Main St"],
            city:                process.env.FEDEX_SHIPPER_CITY    ?? "",
            ...(process.env.FEDEX_SHIPPER_STATE
              ? { stateOrProvinceCode: process.env.FEDEX_SHIPPER_STATE }
              : {}),
            postalCode:          process.env.FEDEX_SHIPPER_ZIP     ?? "",
            countryCode:         process.env.FEDEX_SHIPPER_COUNTRY ?? "US",
          },
        },
        recipient: {
          address: {
            streetLines: streetLines.length ? streetLines : ["N/A"],
            city:        destination.city,
            ...(destination.state
              ? { stateOrProvinceCode: destination.state }
              : {}),
            postalCode:  destination.zip,
            countryCode: "US",
          },
        },
        pickupType:      "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["LIST"],
        requestedPackageLineItems: [
          {
            weight: {
              units: "LB",
              value: Math.max(parseFloat(String(totalWeightLb)), 0.5),
            },
          },
        ],
      },
    };

    // 4. Call FedEx Rates API
    const rateRes = await fetch(`${FEDEX_URL}/rate/v1/rates/quotes`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
        "X-locale":     "en_US",
      },
      body: JSON.stringify(requestBody),
    });

    const rateText = await rateRes.text();

    if (!rateRes.ok) {
      let details: unknown = rateText;
      try { details = JSON.parse(rateText); } catch { /* keep as text */ }
      console.error("FedEx rate API error:", rateText);
      return NextResponse.json(
        { error: `FedEx rate error (${rateRes.status})`, details },
        { status: 400 }
      );
    }

    // 5. Parse response
    let data: {
      output?: {
        rateReplyDetails?: Array<{
          serviceType:           string;
          serviceName?:          string;
          ratedShipmentDetails?: Array<{
            totalNetCharge?: { amount?: string; currency?: string };
          }>;
          commit?: {
            label?:      string;
            dateDetail?: { dayFormat?: string };
          };
        }>;
      };
    };
    try {
      data = JSON.parse(rateText);
    } catch {
      return NextResponse.json(
        { error: "FedEx returned non-JSON", raw: rateText },
        { status: 500 }
      );
    }

    const rates = (data.output?.rateReplyDetails ?? [])
      .map((r) => ({
        serviceType:  r.serviceType,
        serviceName:  (r.serviceName ?? r.serviceType).trim(),
        rate: parseFloat(
          r.ratedShipmentDetails?.[0]?.totalNetCharge?.amount ?? "0"
        ),
        currency:     r.ratedShipmentDetails?.[0]?.totalNetCharge?.currency ?? "USD",
        deliveryInfo: r.commit?.label ?? r.commit?.dateDetail?.dayFormat ?? null,
      }))
      .sort((a, b) => a.rate - b.rate);

    // Sandbox returns $0 — still return services so UI can show them
    return NextResponse.json({ rates, sandbox: rates.every((r) => r.rate === 0) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FedEx rates route error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
