import type { ShipAddress, PackageInfo, RateResult, LabelResult } from "./types";

const BASE = process.env.FEDEX_API_URL ?? "https://apis-sandbox.fedex.com";

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     process.env.FEDEX_CLIENT_ID     ?? "",
      client_secret: process.env.FEDEX_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FedEx auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

function toFedExAddress(a: ShipAddress) {
  return {
    streetLines:         [a.street1, ...(a.street2 ? [a.street2] : [])],
    city:                a.city,
    stateOrProvinceCode: a.state,
    postalCode:          a.zip,
    countryCode:         a.country,
    residential:         true,
  };
}

const FEDEX_FEATURES         = ["Tracking", "Insurance included"];
const FEDEX_SIGNATURE_OPTIONS = [
  { code: 1, name: "Signature required",      price: 5.55 },
  { code: 2, name: "Adult signature required", price: 6.95 },
];

export async function getFedExRates(
  from: ShipAddress,
  to:   ShipAddress,
  pkg:  PackageInfo
): Promise<RateResult[]> {
  const token = await getToken();

  const body = {
    accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER ?? "" },
    requestedShipment: {
      shipper:         { address: toFedExAddress(from) },
      recipient:       { address: toFedExAddress(to) },
      pickupType:      "DROPOFF_AT_FEDEX_LOCATION",
      packagingType:   "YOUR_PACKAGING",
      rateRequestType: ["ACCOUNT", "LIST"],
      requestedPackageLineItems: [{
        weight:     { units: "LB", value: pkg.weightLbs },
        dimensions: pkg.lengthIn ? {
          length: Math.round(pkg.lengthIn),
          width:  Math.round(pkg.widthIn  ?? 1),
          height: Math.round(pkg.heightIn ?? 1),
          units:  "IN",
        } : undefined,
      }],
    },
  };

  const res = await fetch(`${BASE}/rate/v1/rates/quotes`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-locale":     "en_US",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok || (data?.errors?.length ?? 0) > 0) {
    const errs = (data?.errors ?? []) as { message?: string; code?: string }[];
    const msg  = errs.map((e) => e.message ?? e.code).filter(Boolean).join("; ");
    throw new Error(msg || `FedEx rates failed (HTTP ${res.status})`);
  }

  const rateDetails = data?.output?.rateReplyDetails ?? [];

  const SERVICE_NAMES: Record<string, string> = {
    FEDEX_GROUND:            "FedEx Ground",
    FEDEX_EXPRESS_SAVER:     "FedEx Express Saver",
    FEDEX_2_DAY:             "FedEx 2Day",
    FEDEX_2_DAY_AM:          "FedEx 2Day A.M.",
    STANDARD_OVERNIGHT:      "FedEx Standard Overnight",
    PRIORITY_OVERNIGHT:      "FedEx Priority Overnight",
    FIRST_OVERNIGHT:         "FedEx First Overnight",
    INTERNATIONAL_ECONOMY:   "FedEx International Economy",
    INTERNATIONAL_PRIORITY:  "FedEx International Priority",
  };

  return rateDetails.map((r: Record<string, unknown>) => {
    const costs   = r.ratedShipmentDetails as Record<string, unknown>[];
    const total   = (costs?.[0] as Record<string, unknown>)?.totalNetCharge ?? 0;
    const svcCode = r.serviceType as string;
    return {
      carrier:          "fedex",
      carrierLabel:     "FedEx",
      service:          SERVICE_NAMES[svcCode] ?? svcCode,
      serviceCode:      svcCode,
      totalCost:        parseFloat(String(total)),
      currency:         "USD",
      deliveryDays:     r.commit ? (r.commit as Record<string, unknown>).transitDays as number : undefined,
      features:         FEDEX_FEATURES,
      signatureOptions: FEDEX_SIGNATURE_OPTIONS,
    } satisfies RateResult;
  });
}

export async function purchaseFedExLabel(
  from:          ShipAddress,
  to:            ShipAddress,
  pkg:           PackageInfo,
  serviceCode:   string,
  service:       string,
  signatureCode = 0,
): Promise<LabelResult> {
  const token = await getToken();

  const body = {
    labelResponseOptions: "LABEL",
    accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER ?? "" },
    requestedShipment: {
      shipper:         { contact: { personName: from.name, phoneNumber: from.phone ?? "0000000000" }, address: toFedExAddress(from) },
      recipients:      [{ contact: { personName: to.name, phoneNumber: to.phone ?? "0000000000", emailAddress: "" }, address: toFedExAddress(to) }],
      serviceType:     serviceCode,
      packagingType:   "YOUR_PACKAGING",
      pickupType:      "DROPOFF_AT_FEDEX_LOCATION",
      shippingChargesPayment: {
        paymentType: "SENDER",
        payor: {
          responsibleParty: {
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER ?? "" },
          },
        },
      },
      labelSpecification: {
        labelFormatType: "COMMON2D",
        imageType:       "PNG",
        labelStockType:  "PAPER_4X6",
      },
      requestedPackageLineItems: [{
        weight:     { units: "LB", value: pkg.weightLbs },
        dimensions: pkg.lengthIn ? {
          length: Math.round(pkg.lengthIn),
          width:  Math.round(pkg.widthIn  ?? 1),
          height: Math.round(pkg.heightIn ?? 1),
          units:  "IN",
        } : undefined,
        ...(signatureCode > 0 ? {
          specialServicesRequested: {
            specialServiceTypes:  ["SIGNATURE_OPTION"],
            signatureOptionDetail: {
              optionType: signatureCode === 2 ? "ADULT" : "DIRECT",
            },
          },
        } : {}),
      }],
    },
  };

  const res = await fetch(`${BASE}/ship/v1/shipments`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-locale":     "en_US",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok || (data?.errors?.length ?? 0) > 0) {
    const errs = (data?.errors ?? []) as { message?: string; code?: string }[];
    const msg  = errs.map(e => [e.code, e.message].filter(Boolean).join(": ")).filter(Boolean).join("; ");
    throw new Error(msg || `FedEx label failed (HTTP ${res.status})`);
  }
  const shipment   = data?.output?.transactionShipments?.[0];
  const piece      = shipment?.pieceResponses?.[0];
  const doc        = piece?.packageDocuments?.[0];
  const tracking   = piece?.trackingNumber ?? shipment?.masterTrackingNumber?.trackingNumber ?? "";
  const label64    = doc?.encodedLabel ?? "";
  const rateDetail = shipment?.shipmentRating?.shipmentRateDetails?.[0];
  const cost       = parseFloat(String(rateDetail?.totalNetCharge ?? 0));

  return {
    carrier:        "fedex",
    carrierLabel:   "FedEx",
    service,
    serviceCode,
    trackingNumber: tracking,
    labelBase64:    label64,
    labelFormat:    "PNG",
    cost,
    currency:       "USD",
  };
}
