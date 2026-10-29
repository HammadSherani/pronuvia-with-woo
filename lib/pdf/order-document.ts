import "server-only";
import path from "node:path";
import { readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import { formatDateLong } from "@/lib/utils/timezone";
import { wooFetch } from "@/lib/woo/client";
import type { WooProduct, WooVariation } from "@/lib/woo/types";

// The admin's Invoice / Packing Slip PDFs for an order, laid out like the
// ones the WooCommerce PDF plugin made: logo and shop address, the customer's
// address (billing on the invoice, shipping on the packing slip), order
// details, the products (SKU, weight and attributes from WooCommerce) and, on
// the invoice, the prices and totals.

export type OrderDocKind = "invoice" | "packing-slip";

const SHOP_ADDRESS = ["3609 165 St., Suite 1", "Flushing, NY 11358", "United States (US)"];

type Item = { productId: string; variationId?: number | null; title: string; variantSize?: string; sku?: string; quantity: number; unitPrice: number; lineTotal?: number };

export type OrderDocOrder = {
  orderNumber:     string;
  createdAt:       Date;
  items:           Item[];
  billingAddress:  string | null;
  shippingAddress: string | null;
  shippingMethod:  string | null;
  shippingRate:    number;
  paymentMethod:   string | null;
  subtotal:        number;
  discountAmount:  number;
  couponCode:      string | null;
  taxAmount:       number | null;
  total:           number;
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function addressLines(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as Record<string, string | undefined>;
    if (a && typeof a === "object") {
      const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      return [
        [a.firstName, a.lastName].filter(Boolean).join(" "),
        a.company ?? "",
        a.address1 ?? "", a.address2 ?? "",
        cityLine,
        a.country && a.country !== "US" ? (a.countryName || a.country) : "",
      ].filter(Boolean);
    }
  } catch { /* plain text */ }
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

const PAYMENT_TITLES: Record<string, string> = { CARD: "Credit / Debit Card", WALLET: "Wallet" };

/** SKU, weight and attributes of each line, from WooCommerce (best effort). */
async function productDetails(items: Item[]): Promise<{ label: string; value: string }[][]> {
  let unit = "";
  try {
    unit = (await wooFetch<{ value: string }>("wc/v3/settings/products/woocommerce_weight_unit")).data.value ?? "";
  } catch { /* weight shown without a unit */ }
  return Promise.all(items.map(async (it) => {
    let product: WooProduct | null = null;
    let variation: WooVariation | null = null;
    try {
      product = (await wooFetch<WooProduct>(`wc/v3/products/${it.productId}`)).data;
      if (it.variationId) variation = (await wooFetch<WooVariation>(`wc/v3/products/${it.productId}/variations/${it.variationId}`)).data;
    } catch { /* only what the order has */ }
    const rows: { label: string; value: string }[] = [];
    const sku = variation?.sku || product?.sku || it.sku;
    if (sku) rows.push({ label: "SKU", value: sku });
    const weight = variation?.weight || product?.weight;
    if (weight) rows.push({ label: "Weight", value: `${weight}${unit}` });
    if (variation) {
      for (const a of variation.attributes) if (a.option) rows.push({ label: a.name, value: a.option });
    } else if (product) {
      for (const a of product.attributes) if (a.options.length) rows.push({ label: a.name, value: a.options.join(", ") });
    } else if (it.variantSize) {
      rows.push({ label: "Size", value: it.variantSize });
    }
    return rows;
  }));
}

export async function generateOrderDocumentPdf(kind: OrderDocKind, order: OrderDocOrder): Promise<Buffer> {
  const invoice = kind === "invoice";
  const details = await productDetails(order.items);
  let logo: Buffer | null = null;
  try { logo = readFileSync(path.join(process.cwd(), "public/assets/logo-color.png")); } catch { /* name only */ }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "LETTER", margin: 54, info: { Title: `${invoice ? "Invoice" : "Packing Slip"} ${order.orderNumber}` } });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const L = 54, R = doc.page.width - 54, W = R - L;
      const midX = L + W * 0.6;              // shop address / order details / quantity column
      const priceX = L + W * 0.8;            // price column (invoice)
      const black = "#000000", line = "#cccccc";

      // ── Logo and shop address ──
      if (logo) doc.image(logo, L, 40, { width: 190 });
      else doc.font("Helvetica-Bold").fontSize(24).fillColor(black).text("Pronuvia", L, 50);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text("Pronuvia", midX, 44);
      doc.font("Helvetica").fontSize(10);
      SHOP_ADDRESS.forEach((l) => doc.text(l, midX, doc.y + 2));

      // ── Title ──
      let y = 150;
      doc.font("Helvetica-Bold").fontSize(17).text(invoice ? "INVOICE" : "PACKING SLIP", L, y);
      y += 34;

      // ── Customer address (left) and order details (right) ──
      doc.font("Helvetica").fontSize(10);
      let ay = y;
      for (const l of addressLines(invoice ? order.billingAddress : order.shippingAddress ?? order.billingAddress)) {
        doc.text(l, L, ay, { width: midX - L - 20 });
        ay = doc.y + 2;
      }
      const meta: [string, string][] = [
        ["Order Number:", order.orderNumber],
        ["Order Date:",   formatDateLong(order.createdAt)],
        invoice
          ? ["Payment Method:", PAYMENT_TITLES[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "—"]
          : ["Shipping Method:", order.shippingMethod ?? "—"],
      ];
      let my = y;
      for (const [k, v] of meta) {
        doc.text(k, midX, my, { width: priceX - midX - 6 });
        doc.text(v, priceX, my, { width: R - priceX });
        my = Math.max(doc.y, my + 12) + 4;
      }
      y = Math.max(ay, my) + 30;

      // ── Products ──
      const qtyX = invoice ? midX : priceX;
      const header = () => {
        doc.rect(L, y, W, 22).fill(black);
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10);
        doc.text("Product", L + 5, y + 7);
        doc.text("Quantity", qtyX + 5, y + 7);
        if (invoice) doc.text("Price", priceX + 5, y + 7);
        doc.fillColor(black);
        y += 30;
      };
      header();
      order.items.forEach((it, i) => {
        const rows = details[i];
        const need = 20 + rows.length * 13 + 10;
        if (y + need > doc.page.height - 60) { doc.addPage(); y = 54; header(); }
        doc.font("Helvetica").fontSize(10).fillColor(black);
        doc.text(it.title, L + 5, y, { width: qtyX - L - 15 });
        doc.text(String(it.quantity), qtyX + 5, y);
        if (invoice) doc.text(money(it.lineTotal ?? it.unitPrice * it.quantity), priceX + 5, y);
        let ry = Math.max(doc.y, y + 12) + 6;
        for (const r of rows) {
          doc.font("Helvetica-Bold").fontSize(7.5).text(`${r.label}: `, L + 5, ry, { continued: true });
          doc.font("Helvetica").text(r.value);
          ry = doc.y + 4;
        }
        y = ry + 4;
        doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(line).stroke();
        y += 4;
      });

      // ── Totals (invoice) ──
      if (invoice) {
        const shipping = order.shippingRate > 0
          ? `${money(order.shippingRate)} via ${order.shippingMethod ?? "Shipping"}`
          : `Free${order.shippingMethod ? ` via ${order.shippingMethod}` : ""}`;
        const rows: [string, string, boolean][] = [["Subtotal", money(order.subtotal), false]];
        if (order.discountAmount > 0) rows.push([`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${money(order.discountAmount)}`, false]);
        rows.push(["Shipping", shipping, false]);
        if (order.taxAmount) rows.push(["Tax", money(order.taxAmount), false]);
        rows.push(["Total", money(order.total), true]);
        if (y + rows.length * 24 > doc.page.height - 60) { doc.addPage(); y = 54; }
        rows.forEach(([k, v, bold], i) => {
          const last = i === rows.length - 1;
          if (last) doc.moveTo(qtyX, y).lineTo(R, y).lineWidth(1.25).strokeColor(black).stroke();
          doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text(k, qtyX + 5, y + 7);
          doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(v, priceX + 5, y + 7, { width: R - priceX - 5 });
          y = Math.max(doc.y, y + 19) + 5;
          doc.moveTo(qtyX, y).lineTo(R, y).lineWidth(last ? 1.25 : 0.75).strokeColor(last ? black : line).stroke();
        });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
