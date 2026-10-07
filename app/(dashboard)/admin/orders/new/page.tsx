import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus, ProductStatus } from "@/generated/prisma/enums";
import { CreateOrderForm } from "@/components/admin/create-order-form";

export const metadata = { title: "Create Order – Pronuvia Admin" };

export default async function NewOrderPage() {
  await requireAdmin();

  const [physicians, products] = await Promise.all([
    prisma.partneringPhysician.findMany({
      where: { isApproved: ApprovalStatus.APPROVED },
      select: {
        id: true, firstName: true, lastName: true, nameOfPractice: true,
        commission: true,
        salesRep: { select: { id: true, name: true, commission: true } },
      },
      orderBy: { firstName: "asc" },
    }),
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: { id: true, title: true, variants: true, sku: true, salePrice: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Orders
      </Link>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Create Order</h1>

      <CreateOrderForm physicians={physicians} products={products} />
    </div>
  );
}

