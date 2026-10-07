import { requireSalesRep }   from "@/lib/auth/dal";
import { prisma }             from "@/lib/db/prisma";
import { SalesAccountClient } from "@/components/sales/account-client";

export const metadata = { title: "My Account – Pronuvia" };

export default async function SalesAccountPage() {
  const session = await requireSalesRep();

  const rep = await prisma.salesRepresentative.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true, lastName: true, name: true, email: true,
      phone: true, website: true,
      commission: true, walletBalance: true, ordersCount: true,
      billingAddress: true, shippingAddress: true,
      bankName: true, bankAccountName: true, bankAccountNumber: true, bankAccountType: true, bankOwnershipType: true, swiftCode: true, routingNumber: true,
      createdAt: true,
      _count: { select: { physicians: true } },
    },
  });

  if (!rep) return <div className="text-gray-500">Account not found.</div>;

  return <SalesAccountClient rep={rep} />;
}
