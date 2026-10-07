import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { CartProvider } from "@/lib/cart/cart-context";
import { OrderBehalfBar } from "@/components/admin/order-behalf-bar";

type Props = {
  children: React.ReactNode;
  params:   Promise<{ physicianId: string }>;
};

export default async function OrderBehalfLayout({ children, params }: Props) {
  const { physicianId } = await params;

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: physicianId, isApproved: ApprovalStatus.APPROVED },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!physician) notFound();

  return (
    <CartProvider cartKey={`admin_behalf_${physicianId}`}>
      <div className="sticky top-0 z-30 -mx-4 px-4 pb-3 pt-1 bg-white/80 backdrop-blur-sm">
        <OrderBehalfBar
          physicianId={physicianId}
          physicianName={` ${physician.firstName} ${physician.lastName}`}
          physicianEmail={physician.email}
        />
      </div>
      <div className="mt-2">
        {children}
      </div>
    </CartProvider>
  );
}
