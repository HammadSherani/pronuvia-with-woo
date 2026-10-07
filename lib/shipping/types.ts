export type CarrierCode = "fedex" | "ups" | "usps";

// Physical label page size: "4X6" for a thermal label printer, "LETTER" for
// a normal 8.5x11 paper printer.
export type LabelSize = "4X6" | "LETTER";

export interface LabelOptions {
  labelSize?: LabelSize;
  // A return label (customer -> warehouse) instead of a normal outbound
  // label (warehouse -> customer). Only UPS and USPS support this.
  isReturn?:  boolean;
}

export interface ShipAddress {
  name:     string;
  company?: string;
  street1:  string;
  street2?: string;
  city:     string;
  state:    string;
  zip:      string;
  country:  string;
  phone?:   string;
}

export interface PackageInfo {
  weightLbs: number;
  lengthIn?: number;
  widthIn?:  number;
  heightIn?: number;
}

export interface RateResult {
  carrier:          CarrierCode;
  carrierLabel:     string;
  service:          string;
  serviceCode:      string;
  totalCost:        number;
  currency:         string;
  deliveryDays?:    number;
  deliveryDate?:    string;
  features?:        string[];
  signatureOptions?: { code: number; name: string; price: number }[];
}

export interface LabelResult {
  carrier:        CarrierCode;
  carrierLabel:   string;
  service:        string;
  serviceCode:    string;
  trackingNumber: string;
  labelBase64:    string;
  labelFormat:    "PNG" | "PDF" | "GIF";
  cost:           number;
  currency:       string;
}
