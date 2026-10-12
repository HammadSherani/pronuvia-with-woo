import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/enums";
import { startCardPayment } from "@/lib/checkout/card-payment";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const physicianId = (body as { physicianId?: unknown } | null)?.physicianId;
  if (typeof physicianId !== "string" || !physicianId) {
    return NextResponse.json({ error: "Physician ID required" }, { status: 400 });
  }

  // The order is the physician's, so physician-only coupons apply
  return startCardPayment({
    body,
    role:        "PHYSICIAN",
    userId:      session.userId,
    physicianId,
    metadata:    { physicianId, adminId: session.userId, onBehalf: "true" },
  });
}
