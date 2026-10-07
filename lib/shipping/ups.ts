import type { ShipAddress, PackageInfo, RateResult, LabelResult, LabelOptions } from "./types";

// Use UPS_API_URL=https://wwwcie.ups.com for sandbox, or https://onlinetools.ups.com for production
const BASE = process.env.UPS_API_URL ?? "https://wwwcie.ups.com";

async function getToken(): Promise<string> {
  const creds = Buffer.from(
    `${process.env.UPS_CLIENT_ID ?? ""}:${process.env.UPS_CLIENT_SECRET ?? ""}`
  ).toString("base64");

  const res = await fetch(`${BASE}/security/v1/oauth/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`UPS auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

const UPS_SERVICES: Record<string, string> = {
  "03": "UPS Ground",
  "02": "UPS 2nd Day Air",
  "01": "UPS Next Day Air",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early",
  "59": "UPS 2nd Day Air A.M.",
};

function toUPSAddress(a: ShipAddress) {
  const phone = (a.phone ?? "").replace(/[^a-zA-Z0-9]/g, "") || "0000000000";
  return {
    Name:            a.name,
    AttentionName:   a.company ?? a.name,
    Phone:           { Number: phone },
    Address: {
      AddressLine:       [a.street1, ...(a.street2 ? [a.street2] : [])],
      City:              a.city,
      StateProvinceCode: a.state,
      PostalCode:        a.zip,
      CountryCode:       a.country,
    },
  };
}

const UPS_FEATURES         = ["Tracking", "Insurance included"];
const UPS_SIGNATURE_OPTIONS = [
  { code: 1, name: "Signature required",      price: 5.35 },
  { code: 2, name: "Adult signature required", price: 8.75 },
];

export async function getUPSRates(
  from: ShipAddress,
  to:   ShipAddress,
  pkg:  PackageInfo
): Promise<RateResult[]> {
  const token = await getToken();

  const body = {
    RateRequest: {
      Request: { RequestOption: "Shop" },
      Shipment: {
        Shipper:    { ...toUPSAddress(from), ShipperNumber: process.env.UPS_ACCOUNT_NUMBER ?? "" },
        ShipTo:     toUPSAddress(to),
        ShipFrom:   toUPSAddress(from),
        Package: {
          PackagingType:  { Code: "02" },
          Dimensions: pkg.lengthIn ? {
            UnitOfMeasurement: { Code: "IN" },
            Length: String(Math.round(pkg.lengthIn)),
            Width:  String(Math.round(pkg.widthIn  ?? 1)),
            Height: String(Math.round(pkg.heightIn ?? 1)),
          } : undefined,
          PackageWeight: {
            UnitOfMeasurement: { Code: "LBS" },
            Weight: String(pkg.weightLbs),
          },
        },
      },
    },
  };

  const res = await fetch(`${BASE}/api/rating/v2/Shop`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      transId:        `rate-${Date.now()}`,
      transactionSrc: "pronuvia",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `UPS rates error (HTTP ${res.status})`;
    try {
      const errData = await res.json();
      const errs = errData?.response?.errors as { code?: string; message?: string }[] ?? [];
      if (errs.length) msg = errs.map(e => [e.code, e.message].filter(Boolean).join(": ")).join("; ");
    } catch { /* keep default */ }
    throw new Error(msg);
  }

  const data   = await res.json();
  const rated  = data?.RateResponse?.RatedShipment ?? [];
  const arr    = Array.isArray(rated) ? rated : [rated];

  return arr.map((r: Record<string, unknown>) => {
    const svcCode  = (r.Service as Record<string, unknown>)?.Code as string;
    const totalAmt = (r.TotalCharges as Record<string, unknown>)?.MonetaryValue;
    return {
      carrier:          "ups",
      carrierLabel:     "UPS",
      service:          UPS_SERVICES[svcCode] ?? `UPS Service ${svcCode}`,
      serviceCode:      svcCode,
      totalCost:        parseFloat(String(totalAmt ?? 0)),
      currency:         "USD",
      deliveryDays:     (r.GuaranteedDelivery as Record<string, unknown>)?.BusinessDaysInTransit as number | undefined,
      features:         UPS_FEATURES,
      signatureOptions: UPS_SIGNATURE_OPTIONS,
    } satisfies RateResult;
  });
}

// UPS Print Return Label — the label is issued synchronously in the ship
// response, same as an outbound label, matching this app's purchase-and-
// display-immediately flow (as opposed to "9" Electronic Return Label,
// which emails a QR code to the customer to generate the label later).
const UPS_RETURN_SERVICE_CODE = "2";

export async function purchaseUPSLabel(
  from:          ShipAddress,
  to:            ShipAddress,
  pkg:           PackageInfo,
  serviceCode:   string,
  service:       string,
  signatureCode = 0,
  opts:          LabelOptions = {},
): Promise<LabelResult> {
  const token = await getToken();
  const isReturn = opts.isReturn ?? false;
  // Billing account (`from`, our warehouse) always pays and is always
  // Shipper. For a return, the package instead travels customer -> us, so
  // ShipTo/ShipFrom swap relative to a normal outbound label.
  const shipTo   = isReturn ? from : to;
  const shipFrom = isReturn ? to   : from;
  const stockSize = opts.labelSize === "LETTER" ? { Height: "11", Width: "8.5" } : { Height: "6", Width: "4" };

  const body = {
    ShipmentRequest: {
      Request:  { RequestOption: "nonvalidate" },
      Shipment: {
        Description: "Pronuvia Order",
        Shipper:     { ...toUPSAddress(from), ShipperNumber: process.env.UPS_ACCOUNT_NUMBER ?? "" },
        ShipTo:      toUPSAddress(shipTo),
        ShipFrom:    toUPSAddress(shipFrom),
        ...(isReturn ? { ReturnService: { Code: UPS_RETURN_SERVICE_CODE } } : {}),
        PaymentInformation: {
          ShipmentCharge: {
            Type: "01",
            BillShipper: { AccountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "" },
          },
        },
        Service:  { Code: serviceCode, Description: "UPS Service" },
        Package: [{
          // UPS requires a package-level Description for return shipments
          // (ReturnService present) — confirmed via sandbox: omitting it
          // fails with "9120201: Missing package description."
          ...(isReturn ? { Description: "Returned merchandise" } : {}),
          Packaging: { Code: "02", Description: "Customer Supplied Package" },
          Dimensions: pkg.lengthIn ? {
            UnitOfMeasurement: { Code: "IN", Description: "Inches" },
            Length: String(Math.round(pkg.lengthIn)),
            Width:  String(Math.round(pkg.widthIn  ?? 1)),
            Height: String(Math.round(pkg.heightIn ?? 1)),
          } : undefined,
          PackageWeight: {
            UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
            Weight: String(pkg.weightLbs),
          },
          ...(signatureCode > 0 ? {
            PackageServiceOptions: {
              DeliveryConfirmation: { DCISType: signatureCode === 2 ? "3" : "2" },
            },
          } : {}),
        }],
      },
      LabelSpecification: {
        LabelImageFormat:  { Code: "PDF" },
        HTTPUserAgent:     "Mozilla/5.0",
        LabelStockSize:    stockSize,
      },
    },
  };

  const res = await fetch(`${BASE}/api/shipments/v1/ship`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      transId:        `ship-${Date.now()}`,
      transactionSrc: "pronuvia",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `UPS label error (HTTP ${res.status})`;
    try {
      const errData = await res.json();
      const errs = errData?.response?.errors as { code?: string; message?: string }[] ?? [];
      if (errs.length) msg = errs.map(e => [e.code, e.message].filter(Boolean).join(": ")).join("; ");
    } catch { /* keep default */ }
    throw new Error(msg);
  }

  const data     = await res.json();
  const results  = data?.ShipmentResponse?.ShipmentResults;
  const pkg0     = results?.PackageResults;
  const pkgArr   = Array.isArray(pkg0) ? pkg0 : [pkg0];
  const label64  = pkgArr[0]?.ShippingLabel?.GraphicImage as string ?? "";
  const tracking = pkgArr[0]?.TrackingNumber as string ?? results?.ShipmentIdentificationNumber ?? "";
  const cost     = parseFloat(String((results?.ShipmentCharges?.TotalCharges?.MonetaryValue) ?? 0));

  return {
    carrier:        "ups",
    carrierLabel:   "UPS",
    service,
    serviceCode,
    trackingNumber: tracking,
    labelBase64:    label64,
    labelFormat:    "PDF",
    cost,
    currency:       "USD",
  };
}
