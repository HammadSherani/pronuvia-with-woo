import { requireSalesRep } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { CheckoutClient } from "@/components/sales/checkout-client";

export const metadata = { title: "Checkout – Pronuvia" };

export default async function CheckoutPage() {
  const session = await requireSalesRep();

  const rep = await prisma.salesRepresentative.findUnique({
    where:  { id: session.userId },
    select: {
      shippingAddress: true,
      billingAddress:  true,
      walletBalance:   true,
      commission:      true,
    },
  });

  return (
    <CheckoutClient
      savedShippingAddress={rep?.shippingAddress ?? ""}
      savedBillingAddress={rep?.billingAddress ?? ""}
      walletBalance={rep?.walletBalance ?? 0}
      commission={rep?.commission ?? 0}
    />
  );
}
