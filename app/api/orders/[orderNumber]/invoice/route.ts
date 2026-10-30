import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/dal";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { ORDER_DOC_SELECT, orderDocumentResponse } from "@/lib/pdf/order-document";

export const dynamic = "force-dynamic";

// The doctor's / rep's Invoice buttons (orders list, order page, dashboard):
// the invoice PDF of one of their own orders, shown in the browser;
// ?download=1 downloads it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where:  { orderNumber },
    select: { ...ORDER_DOC_SELECT, physicianId: true, salesRepId: true },
  });
  const mine =
    session.role === Role.ADMIN ||
    (session.role === Role.PHYSICIAN && order?.physicianId === session.userId) ||
    (session.role === Role.SALES_REP && order?.salesRepId === session.userId);
  if (!order || !mine) return new NextResponse("Not found", { status: 404 });

  return orderDocumentResponse(req, "invoice", order);
}
