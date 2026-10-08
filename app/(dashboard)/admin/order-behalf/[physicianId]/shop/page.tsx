import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { loadShop } from "@/lib/woo/load-shop";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
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

  const [shop, banners] = await Promise.all([loadShop(), getPublishedBanners()]);

  return (
    <div className="space-y-4">
      <BannerCarousel banners={banners} />
      {shop ? (
        <ShopProducts
          products={shop.products}
          categories={shop.categories}
          basePath={`/admin/order-behalf/${physicianId}/shop`}
        />
      ) : <CatalogUnavailable />}
    </div>
  );
}
