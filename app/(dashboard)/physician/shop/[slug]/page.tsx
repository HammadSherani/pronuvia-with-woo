import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePhysician } from "@/lib/auth/dal";
import { getShopProductBySlug } from "@/lib/woo/catalog";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import { ProductDetailClient } from "@/components/sales/product-detail-client";

type Props = { params: Promise<{ slug: string }> };

export default async function PhysicianShopProductPage({ params }: Props) {
  await requirePhysician();
  const { slug } = await params;

  let result: Awaited<ReturnType<typeof getShopProductBySlug>>;
  try {
    result = await getShopProductBySlug(slug);
  } catch (e) {
    console.error("[shop] WooCommerce product failed:", e);
    return <CatalogUnavailable />;
  }
  if (!result) notFound();
  const { product, related } = result;

  return (
    <div className="">
      <Link href="/physician/shop"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Shop
      </Link>

      <ProductDetailClient
        product={product}
        related={related}
        basePath="/physician/shop"
      />
    </div>
  );
}
