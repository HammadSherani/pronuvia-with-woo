import type { ShipAddress, PackageInfo, RateResult, LabelResult, LabelOptions } from "./types";
import { toDateInputValue } from "@/lib/utils/timezone";

const MAX_LOGGED_ERROR_LENGTH = 4_000;
const MAX_USER_ERROR_LENGTH = 600;

function formatUSPSApiError(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "The USPS API returned an empty error response.";

  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const root = data.error && typeof data.error === "object"
      ? data.error as Record<string, unknown>
      : data;
    const messages: string[] = [];

    if (typeof root.code === "string" && root.code) messages.push(root.code);
    if (typeof root.message === "string" && root.message) messages.push(root.message);

    const errors = root.errors;
    if (Array.isArray(errors)) {
      for (const item of errors) {
        if (typeof item === "string") messages.push(item);
        else if (item && typeof item === "object") {
          const error = item as Record<string, unknown>;
          const detail = [error.code, error.message, error.description]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(": ");
          if (detail) messages.push(detail);
        }
      }
    }

    if (messages.length) return [...new Set(messages)].join("; ");
  } catch {
    // USPS occasionally returns plain text. Keep that response as the detail.
  }

  return trimmed.replace(/\s+/g, " ").slice(0, MAX_LOGGED_ERROR_LENGTH);
}

async function throwUSPSApiError(res: Response, operation: string): Promise<never> {
  const body = await res.text();
  const detail = formatUSPSApiError(body);
  console.error(`[USPS ${operation}] API error`, {
    status: res.status,
    statusText: res.statusText,
    body: body.slice(0, MAX_LOGGED_ERROR_LENGTH),
  });
  const userDetail = detail.length > MAX_USER_ERROR_LENGTH
    ? `${detail.slice(0, MAX_USER_ERROR_LENGTH)}…`
    : detail;
  throw new Error(`USPS ${operation} failed (HTTP ${res.status}): ${userDetail}`);
}

async function parseUSPSLabelResponse(res: Response): Promise<{ labelBase64: string; trackingNumber: string; cost: number }> {
  const contentType = res.headers.get("content-type") ?? "";
  console.log("[USPS label] response content-type:", contentType);

  if (contentType.includes("multipart")) {
    const boundary = (contentType.match(/boundary=["']?([^"';\s]+)["']?/) ?? [])[1] ?? "";
    const buf  = Buffer.from(await res.arrayBuffer());
    const text = buf.toString("latin1"); // latin1 preserves bytes exactly

    console.log("[USPS multipart] boundary:", boundary);
    console.log("[USPS multipart] raw first 600 chars:", text.slice(0, 600));
    const parts = text.split(`--${boundary}`);
    let jsonData: Record<string, unknown> = {};
    let pdfContent = "";
    let pdfAlreadyBase64 = false;

    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;
      const hdr  = part.slice(0, headerEnd).toLowerCase();
      const body = part.slice(headerEnd + 4);

      if (hdr.includes("application/json")) {
        try { jsonData = JSON.parse(body.trim()) as Record<string, unknown>; } catch { /* skip */ }
      } else if (hdr.includes("application/pdf")) {
        const raw = body.endsWith("\r\n") ? body.slice(0, -2) : body;
        const stripped = raw.trimStart();
        // USPS sends PDF as base64 text in multipart (name="labelImage") without
        // Content-Transfer-Encoding header. Detect by the universal base64-PDF prefix.
        pdfAlreadyBase64 = hdr.includes("content-transfer-encoding: base64")
          || stripped.startsWith("JVBERi0")
          || stripped.startsWith("JVBER");
        pdfContent = pdfAlreadyBase64
          ? raw.replace(/[\r\n\s]+/g, "") // strip whitespace from base64 text
          : raw;                            // keep binary as-is (latin1)
      }
    }

    const trackingNumber = String(jsonData.trackingNumber ?? "").trim();
    const cost = parseFloat(String(jsonData.postage ?? (jsonData.fees as Array<{ price: number }>)?.[0]?.price ?? 0));
    let labelBase64 = String(jsonData.labelImage ?? jsonData.PDFImage ?? "");
    console.log("[USPS multipart] json keys:", Object.keys(jsonData).join(", "));
    console.log("[USPS multipart] labelImage from json:", labelBase64.length, "chars | pdfContent:", pdfContent.length, "| pdfAlreadyBase64:", pdfAlreadyBase64);
    if (!labelBase64 && pdfContent) {
      labelBase64 = pdfAlreadyBase64
        ? pdfContent
        : Buffer.from(pdfContent, "latin1").toString("base64");
      console.log("[USPS multipart] final label base64 length:", labelBase64.length, "| first20:", labelBase64.slice(0, 20));
    }
    return { labelBase64, trackingNumber, cost };
  }

  // JSON response
  const data = await res.json() as Record<string, unknown>;
  return {
    labelBase64:    String(data?.labelImage ?? data?.PDFImage ?? "").trim(),
    trackingNumber: String(data?.trackingNumber ?? "").trim(),
    cost:           parseFloat(String(data?.postage ?? (data?.fees as Array<{ price: number }>)?.[0]?.price ?? 0)),
  };
}

const BASE = process.env.USPS_BASE_URL ?? "https://api.usps.com";

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/oauth2/v3/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     process.env.USPS_CLIENT_ID     ?? "",
      client_secret: process.env.USPS_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    return throwUSPSApiError(res, "authentication");
  }
  const data = await res.json() as { access_token: string; scope?: string; api_products?: string };
  console.log("[USPS auth] scope:", data.scope, "| products:", data.api_products);
  return data.access_token;
}

const MAIL_CLASSES = [
  { code: "USPS_GROUND_ADVANTAGE", label: "USPS Ground Advantage" },
  { code: "PRIORITY_MAIL",         label: "USPS Priority Mail" },
  { code: "PRIORITY_MAIL_EXPRESS", label: "USPS Priority Mail Express" },
];

type UspsRateOption = { totalBasePrice: number; rates: { productName?: string; description?: string }[] };

function pkgProcessingCategory(pkg: PackageInfo): string {
  const l = pkg.lengthIn ?? 6;
  const w = pkg.widthIn  ?? 4;
  const h = pkg.heightIn ?? 2;
  if (pkg.weightLbs > 25 || l > 34 || w > 17 || h > 17) return "IRREGULAR";
  return "MACHINABLE";
}

const USPS_FEATURES: Record<string, string[]> = {
  USPS_GROUND_ADVANTAGE: ["Tracking", "Insurance (up to $100.00)", "Free pickup"],
  PRIORITY_MAIL:         ["Tracking", "Insurance (up to $100.00)", "Free pickup"],
  PRIORITY_MAIL_EXPRESS: ["Tracking", "Insurance (up to $100.00)"],
};

const USPS_SIGNATURE_OPTIONS = [
  { code: 1, name: "Signature required",      price: 4.15 },
  { code: 2, name: "Adult signature required", price: 9.70 },
];

export async function getUSPSRates(
  from: ShipAddress,
  to:   ShipAddress,
  pkg:  PackageInfo,
): Promise<RateResult[]> {
  const token     = await getToken();
  const originZip = from.zip.slice(0, 5);
  const destZip   = to.zip.slice(0, 5);
  const procCat   = pkgProcessingCategory(pkg);
  // USPS Prices API v3 takes weight in POUNDS (integer, rounded up)
  const wLbs      = Math.max(1, Math.ceil(pkg.weightLbs));
  const lenIn     = Math.ceil(pkg.lengthIn ?? 6);
  const wdIn      = Math.ceil(pkg.widthIn  ?? 4);
  const htIn      = Math.ceil(pkg.heightIn ?? 2);

  console.log("[USPS rates] params:", { originZip, destZip, wLbs, lenIn, wdIn, htIn, procCat, base: BASE });

  const requests = MAIL_CLASSES.map(async ({ code, label }): Promise<RateResult | null> => {
    // For IRREGULAR packages, try IRREGULAR first; fall back to MACHINABLE
    const categories = procCat === "IRREGULAR" ? ["IRREGULAR", "MACHINABLE"] : ["MACHINABLE"];

    for (const cat of categories) {
      try {
        const reqBody: Record<string, unknown> = {
          originZIPCode:               originZip,
          destinationZIPCode:          destZip,
          weight:                      wLbs,
          length:                      lenIn,
          width:                       wdIn,
          height:                      htIn,
          mailClass:                   code,
          processingCategory:          cat,
          destinationEntryFacilityType:"NONE",
          rateIndicator:               "SP",
          priceType:                   "RETAIL",
        };

        const res = await fetch(`${BASE}/prices/v3/total-rates/search`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body:    JSON.stringify(reqBody),
          cache:   "no-store",
        });

        if (!res.ok) {
          const err = await res.text();
          console.error(`USPS rate [${code}/${cat}] ${res.status}:`, err);
          continue; // try next category
        }

        const data    = await res.json();
        const options: UspsRateOption[] = data?.rateOptions ?? [];
        if (!options.length) continue;

        const best  = options.reduce((a, b) => a.totalBasePrice <= b.totalBasePrice ? a : b);
        const total = best.totalBasePrice;
        if (!total) continue;

        const productName = best.rates?.[0]?.productName ?? best.rates?.[0]?.description ?? label;

        return {
          carrier:          "usps",
          carrierLabel:     "USPS",
          service:          productName,
          serviceCode:      code,
          totalCost:        parseFloat(String(total)),
          currency:         "USD",
          features:         USPS_FEATURES[code] ?? [],
          signatureOptions: USPS_SIGNATURE_OPTIONS,
        } satisfies RateResult;
      } catch (e) {
        console.error(`USPS rate [${code}/${cat}] exception:`, e);
      }
    }

    return null;
  });

  const results = await Promise.all(requests);
  return results.filter((r): r is RateResult => r !== null);
}

async function getPaymentToken(oauthToken: string): Promise<string> {
  const crid   = process.env.USPS_CRID           ?? "";
  const accNum = process.env.USPS_ACCOUNT_NUMBER ?? "";
  const mid    = process.env.USPS_MID            ?? "";

  const reqBody = {
    roles: [
      {
        roleName:    "LABEL_OWNER",
        CRID:        crid,
        MID:         mid,
        manifestMID: mid,
        accountType: "EPS",
        accountNumber: accNum,
      },
      {
        roleName:    "PAYER",
        CRID:        crid,
        accountType: "EPS",
        accountNumber: accNum,
      },
    ],
  };
  console.log("[USPS payment] requesting payment authorization", {
    hasCrid: Boolean(crid),
    hasMid: Boolean(mid),
    hasAccountNumber: Boolean(accNum),
  });

  const res = await fetch(`${BASE}/payments/v3/payment-authorization`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${oauthToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify(reqBody),
    cache:   "no-store",
  });

  if (!res.ok) {
    return throwUSPSApiError(res, "payment authorization");
  }

  const data = await res.json() as { paymentAuthorizationToken?: string };
  if (!data.paymentAuthorizationToken) {
    throw new Error(`USPS payment auth: no token in response — ${JSON.stringify(data)}`);
  }
  return data.paymentAuthorizationToken;
}

// USPS Labels API v3 `imageInfo.labelType` — confirmed via a live sandbox
// call that the full enum is exactly: 4X4LABEL, 4X5LABEL, 4X6LABEL,
// 6X4LABEL, 2X7LABEL. There is no 8.5x11/Letter option — USPS labels are
// thermal-size only through this API.
const USPS_LABEL_TYPE: Record<"4X6", string> = {
  "4X6": "4X6LABEL",
};

export async function purchaseUSPSLabel(
  from:          ShipAddress,
  to:            ShipAddress,
  pkg:           PackageInfo,
  serviceCode:   string,
  service:       string,
  signatureCode = 0,
  opts:          LabelOptions = {},
): Promise<LabelResult> {
  if (opts.labelSize === "LETTER") {
    throw new Error("USPS does not support 8.5×11 (Letter) labels — only 4×6 thermal labels. Choose UPS for a Letter-size label, or switch this to 4×6.");
  }

  const missingPaymentFields = [
    ["USPS_CRID", process.env.USPS_CRID],
    ["USPS_MID", process.env.USPS_MID],
    ["USPS_ACCOUNT_NUMBER", process.env.USPS_ACCOUNT_NUMBER],
  ].filter(([, value]) => !value?.trim()).map(([name]) => name);
  if (missingPaymentFields.length) {
    throw new Error(`USPS label purchase is not configured. Missing: ${missingPaymentFields.join(", ")}.`);
  }

  const token        = await getToken();
  const paymentToken = await getPaymentToken(token);

  // The rates endpoint accepts whole pounds, but the labels endpoint requires
  // the unit fields and accepts the actual package weight (for example 0.5 lb).
  const weightLbs = Math.max(0.1, Number(pkg.weightLbs.toFixed(2)));

  const isReturn = opts.isReturn ?? false;
  // For a return, the package travels customer -> us: `to` (destination)
  // becomes our warehouse (`from`), `from` (origin) becomes the customer (`to`).
  const dest   = isReturn ? from : to;
  const origin = isReturn ? to   : from;

  const destNameParts   = dest.name.trim().split(/\s+/);
  const originNameParts = origin.name.trim().split(/\s+/);

  const body = {
    toAddress: {
      firstName:        destNameParts[0] || "Customer",
      lastName:         destNameParts.slice(1).join(" ") || "-",
      firm:             dest.company ?? undefined,
      streetAddress:    dest.street1,
      secondaryAddress: dest.street2 ?? undefined,
      city:             dest.city,
      state:            dest.state,
      ZIPCode:          dest.zip.slice(0, 5),
      ignoreBadAddress: true,
    },
    fromAddress: {
      firstName:     originNameParts[0] || "Sender",
      lastName:      originNameParts.slice(1).join(" ") || "-",
      firm:          origin.company ?? undefined,
      streetAddress: origin.street1,
      city:          origin.city,
      state:         origin.state,
      ZIPCode:       origin.zip.slice(0, 5),
      phone:         origin.phone ?? undefined,
    },
    packageDescription: {
      mailClass:                    serviceCode,
      processingCategory:           pkgProcessingCategory(pkg),
      rateIndicator:                "SP",
      destinationEntryFacilityType: "NONE",
      weightUOM:                    "lb",
      weight:                       weightLbs,
      dimensionsUOM:                "in",
      length:                       Math.ceil(pkg.lengthIn ?? 6),
      width:                        Math.ceil(pkg.widthIn  ?? 4),
      height:                       Math.ceil(pkg.heightIn ?? 2),
      mailingDate:                  toDateInputValue(new Date()),
      // 921 = Signature Confirmation, 922 = Adult Signature Required.
      // 910/911 are Certified Mail services and do not match these UI options.
      extraServices:                signatureCode === 1 ? [921] : signatureCode === 2 ? [922] : [],
    },
    imageInfo: {
      imageType:       "PDF",
      labelType:       USPS_LABEL_TYPE["4X6"],
      receiptOption:   "NONE",
      suppressPostage: false,
      suppressMailDate:false,
      returnLabel:     isReturn,
    },
  };

  console.log("[USPS label] request body:", JSON.stringify(body, null, 2));

  const res = await fetch(`${BASE}/labels/v3/label`, {
    method: "POST",
    headers: {
      Authorization:               `Bearer ${token}`,
      "X-Payment-Authorization-Token": paymentToken,
      "Content-Type":              "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    return throwUSPSApiError(res, "label purchase");
  }

  const { labelBase64: label64, trackingNumber: tracking, cost } = await parseUSPSLabelResponse(res);

  if (!tracking || !label64) {
    console.error("[USPS label purchase] USPS returned an incomplete label response", {
      trackingNumberPresent: Boolean(tracking),
      labelPresent: Boolean(label64),
      cost,
    });
    throw new Error("USPS label purchase failed: USPS did not return a tracking number and label PDF.");
  }

  return {
    carrier:        "usps",
    carrierLabel:   "USPS",
    service,
    serviceCode,
    trackingNumber: tracking,
    labelBase64:    label64,
    labelFormat:    "PDF",
    cost,
    currency:       "USD",
  };
}
