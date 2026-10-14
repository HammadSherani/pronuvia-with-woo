import { requirePhysician } from "@/lib/auth/dal";
import { loadShop } from "@/lib/woo/load-shop";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import { ShopProducts } from "@/components/sales/shop-products";
import { BannerCarousel } from "@/components/dashboard/banner-carousel";
import { getPublishedBanners } from "@/actions/admin/banners";

export const metadata = { title: "Shop – Pronuvia" };

export default async function PhysicianShopPage() {
  await requirePhysician();

  const [shop, banners] = await Promise.all([loadShop(), getPublishedBanners()]);

  return (
    <div className="space-y-6">
      <BannerCarousel banners={banners} />
      {shop
        ? <ShopProducts products={shop.products} categories={shop.categories} basePath="/physician/shop" />
        : <CatalogUnavailable />}
    </div>
  );
}
