import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ProductStatus, ApprovalStatus } from "@/generated/prisma/enums";
import { ShopProducts } from "@/components/sales/shop-products";
import { BannerCarousel } from "@/components/dashboard/banner-carousel";
import { getPublishedBanners } from "@/actions/admin/banners";

type Props = { params: Promise<{ physicianId: string }> };

export const metadata = { title: "Order on Behalf – Pronuvia Admin" };

export default async function BehalfShopPage({ params }: Props) {
  await requireAdmin();
  const { physicianId } = await params;

  const physician = await prisma.partneringPhysician.findUnique({
    where:  { id: physicianId, isApproved: ApprovalStatus.APPROVED },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!physician) notFound();

  const [products, categories, banners] = await Promise.all([
    prisma.product.findMany({
      where:   { status: ProductStatus.ACTIVE },
      select: {
        id: true, title: true, slug: true, image: true,
        salePrice: true, variants: true,
        category: { select: { id: true, name: true } },
        status: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getPublishedBanners(),
  ]);

  return (
    <div className="space-y-4">
      <BannerCarousel banners={banners} />
      <ShopProducts
        products={products}
        categories={categories}
        basePath={`/admin/order-behalf/${physicianId}/shop`}
      />
    </div>
  );
}
