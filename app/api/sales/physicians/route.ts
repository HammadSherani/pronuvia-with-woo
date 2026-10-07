import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { Role, ApprovalStatus } from "@/generated/prisma/enums";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== Role.SALES_REP) {
    return NextResponse.json([], { status: 401 });
  }

  const physicians = await prisma.partneringPhysician.findMany({
    where:   { salesRepId: session.userId, isApproved: ApprovalStatus.APPROVED },
    select:  { id: true, firstName: true, lastName: true, nameOfPractice: true },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json(physicians);
}

