import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/dal";
import { Role } from "@/generated/prisma/enums";
import { getOrderById } from "@/actions/admin/manage-orders";
import { generateOrderDocumentPdf, type OrderDocKind } from "@/lib/pdf/order-document";

export const dynamic = "force-dynamic";

// The order page's Invoice / Packing Slip buttons: the PDF opens in the
// browser (its viewer can save it); ?download=1 downloads it straight away.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== Role.ADMIN) return new NextResponse("Unauthorized", { status: 401 });

  const { id, kind } = await params;
  if (kind !== "invoice" && kind !== "packing-slip") return new NextResponse("Not found", { status: 404 });

  const order = await getOrderById(id);
  if (!order) return new NextResponse("Not found", { status: 404 });

  const pdf = await generateOrderDocumentPdf(kind as OrderDocKind, {
    orderNumber:     order.orderNumber,
    createdAt:       order.createdAt,
    items:           order.items as unknown as Parameters<typeof generateOrderDocumentPdf>[1]["items"],
    billingAddress:  order.billingAddress,
    shippingAddress: order.shippingAddress,
    shippingMethod:  order.shippingMethod,
    shippingRate:    order.shippingRate,
    paymentMethod:   order.paymentMethod,
    subtotal:        order.subtotal,
    discountAmount:  order.discountAmount,
    couponCode:      order.couponCode,
    taxAmount:       order.taxAmount,
    total:           order.total,
  });

  const filename = `${kind}-${order.orderNumber}.pdf`;
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Content-Length":      String(pdf.length),
      "Cache-Control":       "no-store",
    },
  });
}
