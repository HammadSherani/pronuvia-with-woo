import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePhysician } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ProductStatus } from "@/generated/prisma/enums";
import { ProductDetailClient } from "@/components/sales/product-detail-client";

type Props = { params: Promise<{ slug: string }> };

export default async function PhysicianShopProductPage({ params }: Props) {
  await requirePhysician();
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where:  { slug, status: ProductStatus.ACTIVE },
    select: {
      id: true, title: true, slug: true, description: true,
      image: true, imageGallery: true,
      salePrice: true, compareAtPrice: true,
      variants: true, tags: true,
      categoryId: true,
      category:    { select: { name: true } },
      subCategory: { select: { name: true } },
    },
  });

  if (!product) notFound();

  const related = product.categoryId
    ? await prisma.product.findMany({
        where:   { categoryId: product.categoryId, status: ProductStatus.ACTIVE, slug: { not: slug } },
        select:  { id: true, title: true, slug: true, image: true, salePrice: true, variants: true, category: { select: { name: true } } },
        take:    4,
        orderBy: { createdAt: "desc" },
      })
    : [];

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
