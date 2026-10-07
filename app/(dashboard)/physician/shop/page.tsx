import { requirePhysician } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ProductStatus } from "@/generated/prisma/enums";
import { ShopProducts } from "@/components/sales/shop-products";
import { BannerCarousel } from "@/components/dashboard/banner-carousel";
import { getPublishedBanners } from "@/actions/admin/banners";

export const metadata = { title: "Shop – Pronuvia" };

export default async function PhysicianShopPage() {
  await requirePhysician();

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
    <div className="space-y-6">
      <BannerCarousel banners={banners} />
      <ShopProducts products={products} categories={categories} basePath="/physician/shop" />
    </div>
  );
}
