import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/enums";
import { startCardPayment } from "@/lib/checkout/card-payment";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.PHYSICIAN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return startCardPayment({
    body:     await req.json().catch(() => null),
    role:     "PHYSICIAN",
    userId:   session.userId,
    metadata: { physicianId: session.userId },
  });
}
