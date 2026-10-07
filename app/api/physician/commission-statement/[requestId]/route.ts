import { requirePhysician }               from "@/lib/auth/dal";
import { prisma }                         from "@/lib/db/prisma";
import { generateCommissionStatementPdf } from "@/lib/pdf/commission-statement";
import { getPayoutStatementOrders }       from "@/lib/withdrawals/statement";
import { parsePayoutPeriod }               from "@/lib/withdrawals/monthly";
import { NextRequest, NextResponse }      from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await requirePhysician();
  const { requestId } = await params;

  // Fetch the withdraw request — must belong to this physician and be APPROVED
  const request = await prisma.withdrawRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, userRole: true, amount: true, note: true, status: true, createdAt: true, snapshotAt: true },
  });

  if (
    !request ||
    request.userId   !== session.userId ||
    request.userRole !== "PHYSICIAN"   ||
    request.status   !== "APPROVED"
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Fetch physician info
  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: session.userId },
    select: { firstName: true, lastName: true, bankName: true, bankAccountName: true },
  });

  if (!physician) return new NextResponse("Not found", { status: 404 });

  const orders = await getPayoutStatementOrders({
    userId: session.userId,
    userRole: "PHYSICIAN",
    requestCreatedAt: request.snapshotAt ?? request.createdAt,
  });

  const period = parsePayoutPeriod(request.note, request.snapshotAt ?? request.createdAt);

  const pdfBuf = await generateCommissionStatementPdf({
    recipientName:   `${physician.firstName} ${physician.lastName}`,
    role:            "Partnering Physician",
    period,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      createdAt:   o.createdAt.toISOString(),
      amount:      o.amount,
      rate:        o.rate,
      description: o.description,
    })),
    totalAmount:     request.amount,
    bankName:        physician.bankName,
    bankAccountName: physician.bankAccountName,
  });

  const safePeriod  = period.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename    = `commission-statement-${safePeriod}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuf), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(pdfBuf.length),
    },
  });
}
