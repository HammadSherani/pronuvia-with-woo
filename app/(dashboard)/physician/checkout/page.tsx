import { requirePhysician } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { PhysicianCheckoutClient } from "@/components/physician/checkout-client";

export const metadata = { title: "Checkout – Pronuvia" };

export default async function PhysicianCheckoutPage() {
  const session = await requirePhysician();

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: session.userId },
    select: {
      email:         true,
      firstName:     true,
      lastName:      true,
      phone:         true,
      addressOne:    true,
      addressTwo:    true,
      city:          true,
      state:         true,
      zipCode:       true,
      country:       true,
      walletBalance: true,
    },
  });

  const initialAddress = {
    firstName: physician?.firstName  ?? "",
    lastName:  physician?.lastName   ?? "",
    phone:     physician?.phone      ?? "",
    address1:  physician?.addressOne ?? "",
    address2:  physician?.addressTwo ?? "",
    city:      physician?.city       ?? "",
    state:     physician?.state      ?? "",
    zip:       physician?.zipCode    ?? "",
    country:   physician?.country    ?? "US",
  };

  return (
    <PhysicianCheckoutClient
      physicianEmail={physician?.email ?? session.email ?? ""}
      initialAddress={initialAddress}
      walletBalance={physician?.walletBalance ?? 0}
    />
  );
}
