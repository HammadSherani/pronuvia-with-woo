import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { BehalfCheckoutClient } from "@/components/admin/order-behalf-checkout-client";

export const metadata = { title: "Checkout on Behalf – Pronuvia Admin" };

type Props = { params: Promise<{ physicianId: string }> };

export default async function BehalfCheckoutPage({ params }: Props) {
  await requireAdmin();
  const { physicianId } = await params;

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: physicianId, isApproved: ApprovalStatus.APPROVED },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      addressOne: true, addressTwo: true, city: true, state: true, zipCode: true,
    },
  });
  if (!physician) notFound();

  const initialAddress = {
    firstName: physician.firstName,
    lastName:  physician.lastName,
    phone:     physician.phone      ?? "",
    address1:  physician.addressOne ?? "",
    address2:  physician.addressTwo ?? "",
    city:      physician.city       ?? "",
    state:     physician.state      ?? "",
    zip:       physician.zipCode    ?? "",
    country:   "US",
  };

  return (
    <BehalfCheckoutClient
      physicianId={physicianId}
      physicianName={` ${physician.firstName} ${physician.lastName}`}
      physicianEmail={physician.email}
      initialAddress={initialAddress}
    />
  );
}
