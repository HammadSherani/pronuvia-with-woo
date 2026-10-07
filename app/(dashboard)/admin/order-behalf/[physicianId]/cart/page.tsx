import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { BehalfCartClient } from "@/components/admin/order-behalf-cart-client";

export const metadata = { title: "Cart – Order on Behalf | Pronuvia Admin" };

type Props = { params: Promise<{ physicianId: string }> };

export default async function BehalfCartPage({ params }: Props) {
  await requireAdmin();
  const { physicianId } = await params;

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: physicianId, isApproved: ApprovalStatus.APPROVED },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!physician) notFound();

  return (
    <BehalfCartClient
      physicianId={physicianId}
      physicianName={` ${physician.firstName} ${physician.lastName}`}
      physicianEmail={physician.email}
    />
  );
}
