import PDFDocument from "pdfkit";
import { formatDate, formatDateLong } from "@/lib/utils/timezone";

export interface CommissionOrder {
  orderNumber: string;
  createdAt:   string;
  amount:      number;
  rate:        number;
  description?: string | null;
}

export async function generateCommissionStatementPdf(opts: {
  recipientName: string;
  role:          string;
  period:        string;
  orders:        CommissionOrder[];
  totalAmount:   number;
  bankName?:     string | null;
  bankAccountName?: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });

      doc.on("data",  (c) => chunks.push(c));
      doc.on("end",   ()  => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);

      const W    = doc.page.width - 100; // usable width (margins = 50 each side)
      const navy = "#1b3b6f";
      const teal = "#3DBFA4";
      const gray = "#6b7280";
      const lt   = "#f3f4f6";
      const formatMoney = (amount: number) => amount.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });

      // ── Header bar ───────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 70).fill(navy);
      doc
        .fillColor("#ffffff")
        .fontSize(22).font("Helvetica-Bold")
        .text("PRONUVIA", 50, 18, { lineBreak: false });
      doc
        .fontSize(9).font("Helvetica")
        .fillColor("rgba(255,255,255,0.6)")
        .text("Commission Payout Statement", 50, 46, { lineBreak: false });

      // right-align period
      doc
        .fontSize(9).font("Helvetica-Bold")
        .fillColor("#ffffff")
        .text(opts.period, 50, 46, { align: "right", width: W, lineBreak: false });

      let y = 90;

      // ── Recipient block ───────────────────────────────────────────────────
      doc.fillColor(navy).fontSize(13).font("Helvetica-Bold")
         .text(opts.recipientName, 50, y);
      y += 18;
      doc.fillColor(gray).fontSize(9).font("Helvetica")
         .text(opts.role, 50, y);
      y += 13;
      if (opts.bankAccountName || opts.bankName) {
        doc.text([opts.bankAccountName, opts.bankName].filter(Boolean).join(" · "), 50, y);
        y += 13;
      }
      y += 8;

    // thin teal divider
    doc.moveTo(50, y).lineTo(50 + W, y).lineWidth(1).strokeColor(teal).stroke();
    y += 14;

    // ── Summary tile ─────────────────────────────────────────────────────
    doc.rect(50, y, W, 36).fillColor("#f0fdf9").fill();
    doc.fillColor(teal).fontSize(9).font("Helvetica-Bold")
       .text("TOTAL COMMISSION PAYOUT", 62, y + 8, { lineBreak: false });
    doc.fillColor(navy).fontSize(16).font("Helvetica-Bold")
       .text(formatMoney(opts.totalAmount), 50, y + 6, { align: "right", width: W, lineBreak: false });
    y += 52;

    // ── Orders table header ───────────────────────────────────────────────
    doc.fillColor(navy).fontSize(8).font("Helvetica-Bold");
    const col = { num: 62, date: 235, rate: 380, amt: 465 };

    doc.rect(50, y, W, 20).fillColor(navy).fill();
    doc.fillColor("#ffffff");
    doc.text("ORDER #",     col.num,  y + 6, { lineBreak: false });
    doc.text("DATE",        col.date, y + 6, { lineBreak: false });
    doc.text("RATE",        col.rate, y + 6, { lineBreak: false });
    doc.text("COMMISSION",  col.amt,  y + 6, { lineBreak: false });
    y += 20;

    // ── Orders rows ──────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica");
    for (let i = 0; i < opts.orders.length; i++) {
      const o       = opts.orders[i];
      const rowBg   = i % 2 === 0 ? "#ffffff" : lt;
      const rowH    = 18;

      // check for page overflow
      if (y + rowH > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }

      doc.rect(50, y, W, rowH).fillColor(rowBg).fill();
      doc.fillColor("#111827");
      const orderLabel = o.orderNumber === "Wallet adjustment"
        ? (o.description?.toLowerCase().startsWith("withdrawal approved by admin")
          ? "Paid Commission"
          : o.description || o.orderNumber)
        : `#${o.orderNumber}`;
      doc.text(orderLabel, col.num, y + 4, {
        lineBreak: false,
        width: 160,
        ellipsis: true,
      });
      doc.text(
        formatDate(o.createdAt),
        col.date, y + 4, { lineBreak: false }
      );
      doc.fillColor(teal);
      doc.text(`${o.rate}%`, col.rate, y + 4, { lineBreak: false });
      doc.fillColor("#047857");
      doc.text(formatMoney(o.amount), col.amt, y + 4, { lineBreak: false });
      y += rowH;
    }

    // total row
    y += 4;
    doc.rect(50, y, W, 24).fillColor(teal).fill();
    doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
    doc.text("Total Commission Payout", col.num, y + 7, { lineBreak: false });
    doc.text(formatMoney(opts.totalAmount), col.amt, y + 7, { lineBreak: false });
    y += 24;

    // ── Footer ────────────────────────────────────────────────────────────
    if (y + 60 > doc.page.height - 50) {
      doc.addPage();
      y = doc.page.height - 90;
    } else {
      y = doc.page.height - 80;
    }

    doc.moveTo(50, y).lineTo(50 + W, y).lineWidth(0.5).strokeColor("#e5e7eb").stroke();
    y += 10;
    doc.fillColor(gray).fontSize(8).font("Helvetica")
       .text(
         `Generated on ${formatDateLong(new Date())}  ·  Pronuvia, Inc.  ·  This is an auto-generated statement.`,
         50, y, { align: "center", width: W }
       );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
