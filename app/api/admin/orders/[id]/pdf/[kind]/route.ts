import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/dal";
import { Role } from "@/generated/prisma/enums";
import { getOrderById } from "@/actions/admin/manage-orders";
import { orderDocumentResponse, type OrderDocKind } from "@/lib/pdf/order-document";

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

  return orderDocumentResponse(req, kind as OrderDocKind, order);
}
